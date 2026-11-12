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
  const { data: order, error } = await supabase
    .from('sales_orders')
    .select('id, order_number, status')
    .eq('order_number', 'SO-0035')
    .single();
  if (error) throw error;

  const { data: lines } = await supabase
    .from('sales_order_lines')
    .select('id, quantity, product_id, products(name)')
    .eq('sales_order_id', order.id);

  const { data: adjs } = await supabase
    .from('stock_adjustments')
    .select('*')
    .eq('reference_id', order.id);

  console.log('Order:', order);
  console.log('Lines:', lines);
  console.log('Adjustments:', adjs);
}

main();
