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
  const orderIds = [
    'c70308af-37bc-46d1-9cf9-edbcc602c3dd',
    '98234041-6766-4aa1-9976-8920ab3f8cc9',
    '4de2c547-d58e-4864-aa79-00d902378a48',
    '40aacf37-4765-4724-baf7-d7d70b1fd249',
    '7e35bb05-f2a3-4639-b6b6-98d2dda213b8',
    '4772f599-3a20-42bd-842c-6a4ade7ac11f'
  ];

  const { data: orders, error } = await supabase
    .from('sales_orders')
    .select('id, order_number, status')
    .in('id', orderIds);
  if (error) throw error;
  console.log('Orders status for mismatching list:', orders);
}

main();
