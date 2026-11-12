/**
 * Schema Verification Script
 * Run with: node scripts/check-schema.cjs
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wmaolzkmttohwvipvtrd.supabase.co';
const supabaseKey = 'sb_publishable_lUM5gX_wV_3e7BGWWq5B-g_GfnA8gbH';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('=== RDS SCHEMA VERIFICATION ===\n');

  // Check sales_order_lines schema
  const soLinesResult = await supabase.from('sales_order_lines').select('*').limit(1);
  console.log('sales_order_lines sample:', JSON.stringify(soLinesResult.data?.[0], null, 2));

  // Check purchase_orders schema
  const poResult = await supabase.from('purchase_orders').select('*').limit(1);
  console.log('\npurchase_orders sample:', JSON.stringify(poResult.data?.[0], null, 2));

  // Check purchase_order_lines schema
  const poLinesResult = await supabase.from('purchase_order_lines').select('*').limit(1);
  console.log('\npurchase_order_lines sample:', JSON.stringify(poLinesResult.data?.[0], null, 2));

  // Check payments schema
  const paymentsResult = await supabase.from('payments').select('*').limit(1);
  console.log('\npayments sample:', JSON.stringify(paymentsResult.data?.[0], null, 2));

  // Get column names
  const soLinesCols = Object.keys(soLinesResult.data?.[0] || {});
  const poCols = Object.keys(poResult.data?.[0] || {});
  const poLinesCols = Object.keys(poLinesResult.data?.[0] || {});
  const paymentsCols = Object.keys(paymentsResult.data?.[0] || {});

  console.log('\n=== COLUMN NAMES ===');
  console.log('sales_order_lines:', soLinesCols);
  console.log('purchase_orders:', poCols);
  console.log('purchase_order_lines:', poLinesCols);
  console.log('payments:', paymentsCols);

  // Check for orphan lines
  const { allSOs } = await supabase
    .from('sales_orders')
    .select('id, order_number')
    .eq('is_deleted', false);

  const soIds = new Set((allSOs || []).map(o => o.id));

  const { allLines } = await supabase.from('sales_order_lines').select('*');

  const orphaned = (allLines || []).filter(l => !soIds.has(l.sales_order_id));
  console.log('\nOrphaned sales order lines:', orphaned.length);
  if (orphaned.length > 0) {
    console.log(JSON.stringify(orphaned.slice(0, 5), null, 2));
  }
}

checkSchema();