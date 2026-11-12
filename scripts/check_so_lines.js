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
  const { data: lines, error } = await supabase
    .from('sales_order_lines')
    .select('id, quantity, product_id, sales_order_id, products(name, current_stock)')
    .eq('sales_order_id', 'dab34820-f494-4cec-a0a1-703c2a5fcef8');
  if (error) throw error;
  console.log('Lines for SO-727436-DEL-dab34820:', JSON.stringify(lines, null, 2));
}

main();
