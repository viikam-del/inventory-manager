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
  const { data: deliveredOrders, error } = await supabase
    .from('sales_orders')
    .select('id, order_number, status')
    .in('status', ['Delivered', 'Invoiced']);
  if (error) throw error;

  const orderIds = deliveredOrders.map(o => o.id);
  const { data: orderAdj, error: oaErr } = await supabase
    .from('stock_adjustments')
    .select('reference_id')
    .eq('reference_type', 'SalesOrder')
    .in('reference_id', orderIds);
  if (oaErr) throw oaErr;

  const adjOrderIds = new Set(orderAdj?.map(a => a.reference_id));
  const missing = deliveredOrders.filter(o => !adjOrderIds.has(o.id));

  console.log('Delivered or Invoiced orders missing stock adjustments:', missing);
}

main();
