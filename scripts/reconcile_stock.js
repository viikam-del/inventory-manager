import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('D:/RDS/Projs/inventory-manager/.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  });
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  // Let's find all products and fix their current_stock to match their net adjustments (In - Out)
  const { data: products, error: prodErr } = await supabase.from('products').select('id, name, current_stock');
  if (prodErr) throw prodErr;

  const { data: adjustments, error: adjErr } = await supabase.from('stock_adjustments').select('product_id, adjustment_type, quantity');
  if (adjErr) throw adjErr;

  const stockMap = {};
  adjustments?.forEach(adj => {
    const entry = stockMap[adj.product_id] || { in: 0, out: 0 };
    if (adj.adjustment_type === 'In') entry.in += Number(adj.quantity);
    else if (adj.adjustment_type === 'Out') entry.out += Number(adj.quantity);
    stockMap[adj.product_id] = entry;
  });

  console.log('Synchronizing product stock levels to match net stock adjustments (In - Out)...');
  for (const p of products) {
    const rec = stockMap[p.id] || { in: 0, out: 0 };
    const expected = rec.in - rec.out;
    if (expected !== Number(p.current_stock)) {
      console.log(`Updating ${p.name}: current_stock ${p.current_stock} -> ${expected}`);
      const { error: updateErr } = await supabase
        .from('products')
        .update({ current_stock: expected })
        .eq('id', p.id);
      if (updateErr) console.error(`Error updating ${p.name}:`, updateErr);
    }
  }

  // Also check if any Delivered or Invoiced orders are missing stock adjustments for their lines
  const { data: deliveredOrders, error: delErr } = await supabase
    .from('sales_orders')
    .select('id, order_number, status')
    .in('status', ['Delivered', 'Invoiced']);
  if (delErr) throw delErr;

  const { data: orderAdj, error: oaErr } = await supabase
    .from('stock_adjustments')
    .select('reference_id, product_id, quantity')
    .eq('reference_type', 'SalesOrder');
  if (oaErr) throw oaErr;

  // Group existing adjustments by reference_id and product_id
  const adjMap = {};
  orderAdj?.forEach(a => {
    const key = `${a.reference_id}:${a.product_id}`;
    adjMap[key] = (adjMap[key] || 0) + Number(a.quantity);
  });

  // Fetch all order lines for delivered/invoiced orders
  const orderIds = deliveredOrders.map(o => o.id);
  const { data: allLines, error: lineErr } = await supabase
    .from('sales_order_lines')
    .select('id, sales_order_id, product_id, quantity')
    .in('sales_order_id', orderIds);
  if (lineErr) throw lineErr;

  console.log('Checking for missing line stock adjustments on Delivered/Invoiced orders...');
  for (const line of allLines) {
    const key = `${line.sales_order_id}:${line.product_id}`;
    const adjQty = adjMap[key] || 0;
    const lineQty = Number(line.quantity);
    if (adjQty < lineQty) {
      const diff = lineQty - adjQty;
      const order = deliveredOrders.find(o => o.id === line.sales_order_id);
      console.log(`Adding missing adjustment of ${diff} Out for order ${order?.order_number}, product ID ${line.product_id}`);

      // Insert missing stock adjustment
      await supabase.from('stock_adjustments').insert([
        {
          product_id: line.product_id,
          adjustment_type: 'Out',
          quantity: diff,
          reason: `Automated Reconciliation: ${order?.order_number || 'SalesOrder'}`,
          reference_type: 'SalesOrder',
          reference_id: line.sales_order_id,
        }
      ]);
    }
  }

  // Re-run stock synchronization after adding missing adjustments
  const { data: productsAfter, error: prodErr2 } = await supabase.from('products').select('id, name, current_stock');
  if (prodErr2) throw prodErr2;

  const { data: adjustmentsAfter, error: adjErr2 } = await supabase.from('stock_adjustments').select('product_id, adjustment_type, quantity');
  if (adjErr2) throw adjErr2;

  const stockMapAfter = {};
  adjustmentsAfter?.forEach(adj => {
    const entry = stockMapAfter[adj.product_id] || { in: 0, out: 0 };
    if (adj.adjustment_type === 'In') entry.in += Number(adj.quantity);
    else if (adj.adjustment_type === 'Out') entry.out += Number(adj.quantity);
    stockMapAfter[adj.product_id] = entry;
  });

  for (const p of productsAfter) {
    const rec = stockMapAfter[p.id] || { in: 0, out: 0 };
    const expected = rec.in - rec.out;
    if (expected !== Number(p.current_stock)) {
      console.log(`Final sync for ${p.name}: current_stock ${p.current_stock} -> ${expected}`);
      await supabase
        .from('products')
        .update({ current_stock: expected })
        .eq('id', p.id);
    }
  }

  console.log('Stock reconciliation completed successfully!');
}

main().catch(console.error);
