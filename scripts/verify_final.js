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

  const productDiscrepancies = products?.filter(p => {
    const rec = stockMap[p.id] || { in: 0, out: 0 };
    const expected = rec.in - rec.out;
    return expected !== Number(p.current_stock);
  }) || [];

  console.log('=== Product Stock Discrepancies ===');
  if (productDiscrepancies.length === 0) {
    console.log('None! All product stock levels match net stock adjustments (In - Out perfectly).');
  } else {
    productDiscrepancies.forEach(p => {
      const rec = stockMap[p.id] || { in: 0, out: 0 };
      const expected = rec.in - rec.out;
      console.log(`Product: ${p.name} (ID:${p.id}) | DB Stock:${p.current_stock} | Expected:${expected} | In:${rec.in} Out:${rec.out}`);
    });
  }

  // Check for delivered/invoiced orders lacking stock adjustments
  const { data: deliveredOrders, error: delErr } = await supabase
    .from('sales_orders')
    .select('id, order_number, status')
    .in('status', ['Delivered', 'Invoiced']);
  if (delErr) throw delErr;

  const { data: orderAdj, error: oaErr } = await supabase
    .from('stock_adjustments')
    .select('reference_id')
    .eq('reference_type', 'SalesOrder');
  if (oaErr) throw oaErr;

  const adjOrderIds = new Set(orderAdj?.map(a => a.reference_id));
  const ordersMissingAdj = deliveredOrders?.filter(o => !adjOrderIds.has(o.id)) || [];

  console.log('\n=== Delivered/Invoiced Orders Missing Stock Adjustments ===');
  if (ordersMissingAdj.length === 0) {
    console.log('None! All Delivered and Invoiced orders have stock adjustments.');
  } else {
    ordersMissingAdj.forEach(o => console.log(`Order ${o.order_number} (ID:${o.id}, Status:${o.status})`));
  }
}

main().catch(console.error);
