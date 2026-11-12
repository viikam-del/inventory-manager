import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('D:/RDS/Projs/inventory-manager/.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
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
  const { data, error } = await supabase.from('sales_orders').select('status, count');
  // Let's just fetch all sales order statuses
  const { data: allOrders, error: err2 } = await supabase.from('sales_orders').select('id, order_number, status');
  if (err2) throw err2;

  const counts = {};
  allOrders.forEach(o => {
    counts[o.status] = (counts[o.status] || 0) + 1;
  });
  console.log('Sales Order status counts:', counts);
}

main();
