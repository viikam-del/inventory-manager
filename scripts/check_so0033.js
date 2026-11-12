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
    .select('product_id, adjustment_type, quantity, reference_type, reference_id, reason, created_at')
    .ilike('reason', '%SO-0033%');
  if (error) throw error;
  console.log('Adjustments for SO-0033:', adjustments);

  const { data: order33, error: err2 } = await supabase
    .from('sales_orders')
    .select('id')
    .eq('order_number', 'SO-0033')
    .single();
  if (!err2 && order33) {
    const { data: adjs2 } = await supabase
      .from('stock_adjustments')
      .select('*')
      .eq('reference_id', order33.id);
    console.log('Adjustments by reference_id for SO-0033:', adjs2);
  }
}

main();
