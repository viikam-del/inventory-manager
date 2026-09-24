const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: so } = await supabase.from('sales_orders').select('*').limit(1);
  console.log('sales_orders keys:', Object.keys(so[0] || {}));
  
  const { data: po } = await supabase.from('purchase_orders').select('*').limit(1);
  console.log('purchase_orders keys:', Object.keys(po[0] || {}));

  const { data: rl } = await supabase.from('receipt_lines').select('*').limit(1);
  console.log('receipt_lines keys:', Object.keys(rl[0] || {}));
}
run();
