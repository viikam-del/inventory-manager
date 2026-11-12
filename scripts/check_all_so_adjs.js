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
  const { data: adjustments, error } = await supabase
    .from('stock_adjustments')
    .select('reference_id, product_id, adjustment_type, quantity, reason')
    .eq('reference_type', 'SalesOrder');
  if (error) throw error;

  // Let's group adjustments by reference_id
  const map = {};
  adjustments.forEach(a => {
    if (a.adjustment_type !== 'Out') return;
    map[a.reference_id] = (map[a.reference_id] || 0) + 1;
  });

  console.log('Stock adjustments count per Sales Order (Out):', Object.keys(map).length);

  // Let's find orders that have status Delivered or Invoiced
  const { data: orders } = await supabase
    .from('sales_orders')
    .select('id, order_number, status')
    .in('status', ['Delivered', 'Invoiced']);

  orders.forEach(o => {
    const count = map[o.id] || 0;
    console.log(`Order ${o.order_number} (${o.status}): ${count} adjustment lines`);
  });
}

main();
