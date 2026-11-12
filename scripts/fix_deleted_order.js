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
  const orderId = 'dab34820-f494-4cec-a0a1-703c2a5fcef8';
  // Let's check if there are any products we can assign or if we should insert a dummy adjustment or update order status to Cancelled / remove from active Delivered/Invoiced
  // Since order is soft-deleted (is_deleted: true) and has 0 lines, let's update its status to Cancelled or check its details.
  const { error } = await supabase
    .from('sales_orders')
    .update({ status: 'Cancelled' })
    .eq('id', orderId);
  if (error) console.error('Error updating status:', error);
  else console.log('Successfully updated soft-deleted order SO-727436-DEL-dab34820 to Cancelled status.');
}

main();
