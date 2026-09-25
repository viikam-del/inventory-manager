const fs = require('fs');
const file = 'src/app/dashboard/page.tsx';
let code = fs.readFileSync(file, 'utf8');

const dateInjection = `
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
`;

code = code.replace(/try\s*\{\s*\/\/\s*Fire all independent queries/m, 
`try {
${dateInjection}
        // Fire all independent queries`);

code = code.replace(/supabase\.from\('sales_orders'\)\.select\('total_amount, gst_amount'\)\.eq\('is_deleted', false\)/,
  "supabase.from('sales_orders').select('total_amount, gst_amount').eq('is_deleted', false).gte('order_date', startOfMonth).limit(1000)");

code = code.replace(/supabase\.from\('payments'\)\.select\('amount'\)\.eq\('is_deleted', false\)/,
  "supabase.from('payments').select('amount').eq('is_deleted', false).gte('payment_date', startOfMonth).limit(1000)");

code = code.replace(/supabase\.from\('purchase_orders'\)\.select\('delivery_charges, purchase_order_lines\(quantity, unit_cost, gst_amount\)'\)\.eq\('is_deleted', false\)\.neq\('status', 'Cancelled'\)/,
  "supabase.from('purchase_orders').select('delivery_charges, purchase_order_lines(quantity, unit_cost, gst_amount)').eq('is_deleted', false).neq('status', 'Cancelled').gte('order_date', startOfMonth).limit(100)");

code = code.replace(/supabase\.from\('products'\)\.select\('id, name, current_stock, min_stock_level, unit'\)\.eq\('is_deleted', false\)/,
  "supabase.from('products').select('id, name, current_stock, min_stock_level, unit').eq('is_deleted', false).limit(2000)");

fs.writeFileSync(file, code);
console.log("Done");
