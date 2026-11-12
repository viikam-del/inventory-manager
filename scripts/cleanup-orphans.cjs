/**
 * Clean up orphaned sales order lines
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://wmaolzkmttohwvipvtrd.supabase.co', 'sb_publishable_lUM5gX_wV_3e7BGWWq5B-g_GfnA8gbH');

async function cleanup() {
  const { data: sos } = await supabase.from('sales_orders').select('id');
  const soIds = new Set((sos || []).map(o => o.id));

  const { data: lines } = await supabase.from('sales_order_lines').select('id, sales_order_id');
  const orphaned = (lines || []).filter(l => !soIds.has(l.sales_order_id));

  console.log('Orphaned lines found:', orphaned.length);
  if (orphaned.length > 0) {
    const ids = orphaned.map(l => l.id);
    const { error } = await supabase.from('sales_order_lines').delete().in('id', ids);
    if (error) {
      console.error('Error deleting orphaned lines:', error.message);
    } else {
      console.log('Successfully deleted orphaned lines.');
    }
  }
}
cleanup();
