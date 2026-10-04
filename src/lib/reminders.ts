import { supabase } from './supabase';

export interface AutomatedReminder {
  id: string; // generated client-side for virtual reminders
  type: 'Payment' | 'Reorder' | 'LowStock' | 'Order' | 'Manual';
  title: string;
  description: string;
  reference_type: string;
  reference_id: string;
  whatsapp_number: string | null;
  whatsapp_template: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Snoozed' | 'Dismissed';
}

/**
 * Identify customers with overdue balances.
 */
export async function getPaymentReminders(): Promise<AutomatedReminder[]> {
  const { data: customers } = await supabase.from('customers').select('*').eq('is_deleted', false);
  const { data: salesOrders } = await supabase.from('sales_orders').select('*').eq('is_deleted', false);
  const { data: payments } = await supabase.from('payments').select('*').eq('is_deleted', false);

  if (!customers || !salesOrders || !payments) return [];

  const reminders: AutomatedReminder[] = [];

  customers.forEach((c) => {
    const custOrders = salesOrders.filter(so => so.customer_id === c.id);
    const custPayments = payments.filter(p => p.customer_id === c.id);

    const totalSales = custOrders.reduce((sum, so) => sum + Number(so.total_amount || 0), 0);
    const totalPayments = custPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const balance = Number(c.opening_balance || 0) + totalSales - totalPayments;

    if (balance > 0) {
      const contactName = c.contact_person || c.company_name;
      const amountStr = balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
      const msg = `Hello ${contactName},\n\nThis is a gentle reminder regarding an outstanding balance of ${amountStr} on your account with Rainbow Digital Solutions.\n\nPlease let us know when we can expect the payment.\n\nThank you!`;

      reminders.push({
        id: `pay-${c.id}`,
        type: 'Payment',
        title: `Payment Due: ${c.company_name}`,
        description: `Outstanding balance of ${amountStr}`,
        reference_type: 'Customer',
        reference_id: c.id,
        whatsapp_number: c.whatsapp || null,
        whatsapp_template: msg,
        priority: balance > 50000 ? 'High' : (balance > 10000 ? 'Medium' : 'Low'),
        status: 'Pending',
      });
    }
  });

  return reminders.sort((a, b) => {
    if (a.priority === 'High' && b.priority !== 'High') return -1;
    if (a.priority !== 'High' && b.priority === 'High') return 1;
    return 0;
  });
}

/**
 * Predict customer reorders based on frequency.
 */
export async function getReorderReminders(): Promise<AutomatedReminder[]> {
  const { data: customers } = await supabase.from('customers').select('id, company_name, whatsapp, contact_person').eq('is_deleted', false);
  const { data: salesOrders } = await supabase.from('sales_orders').select('customer_id, order_date').eq('is_deleted', false).order('order_date', { ascending: true });

  if (!customers || !salesOrders) return [];

  const reminders: AutomatedReminder[] = [];

  customers.forEach(c => {
    const orders = salesOrders.filter(so => so.customer_id === c.id);
    if (orders.length < 2) return; // Need at least 2 orders to calculate frequency

    let totalIntervalDays = 0;
    for (let i = 1; i < orders.length; i++) {
      const prevDate = new Date(orders[i - 1].order_date).getTime();
      const currDate = new Date(orders[i].order_date).getTime();
      totalIntervalDays += (currDate - prevDate) / (1000 * 60 * 60 * 24);
    }

    const avgInterval = totalIntervalDays / (orders.length - 1);
    if (avgInterval <= 0) return;

    const lastOrderDate = new Date(orders[orders.length - 1].order_date).getTime();
    const daysSinceLastOrder = (Date.now() - lastOrderDate) / (1000 * 60 * 60 * 24);

    // If it's been 20% longer than their average interval, they are due for reorder
    if (daysSinceLastOrder > avgInterval * 1.2) {
      const contactName = c.contact_person || c.company_name;
      const msg = `Hello ${contactName},\n\nHope you are doing well!\n\nIt's been a while since your last order. Let us know if you need any supplies from Rainbow Digital Solutions.\n\nWe're ready to process your next requirements!`;

      reminders.push({
        id: `reorder-${c.id}`,
        type: 'Reorder',
        title: `Reorder Expected: ${c.company_name}`,
        description: `Avg order interval is ${Math.round(avgInterval)} days. Last order was ${Math.round(daysSinceLastOrder)} days ago.`,
        reference_type: 'Customer',
        reference_id: c.id,
        whatsapp_number: c.whatsapp || null,
        whatsapp_template: msg,
        priority: 'Medium',
        status: 'Pending',
      });
    }
  });

  return reminders.sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Identify low stock items.
 */
export async function getLowStockReminders(): Promise<AutomatedReminder[]> {
  const { data: products } = await supabase.from('products').select('*').eq('is_deleted', false);

  if (!products) return [];

  const reminders: AutomatedReminder[] = [];

  products.forEach(p => {
    // Determine thresholds. Ideally we have min_stock_level on product, fallback to 10.
    const minThreshold = p.min_stock_level !== undefined && p.min_stock_level !== null ? p.min_stock_level : 10;

    if (p.current_stock <= minThreshold) {
      const priority = p.current_stock <= 0 ? 'High' : 'Medium';
      const msg = ''; // Typically internal reminder, no whatsapp template to customer needed. Could be sent to a supplier if we knew the preferred supplier.

      reminders.push({
        id: `stock-${p.id}`,
        type: 'LowStock',
        title: `Low Stock: ${p.name}`,
        description: `Current stock: ${p.current_stock || 0} ${p.unit}. Threshold: ${minThreshold}.`,
        reference_type: 'Product',
        reference_id: p.id,
        whatsapp_number: null,
        whatsapp_template: msg,
        priority: priority,
        status: 'Pending',
      });
    }
  });

  return reminders.sort((a, b) => {
    if (a.priority === 'High' && b.priority !== 'High') return -1;
    if (a.priority !== 'High' && b.priority === 'High') return 1;
    return 0;
  });
}

/**
 * Identify pending purchase/sales orders.
 */
export async function getOrderReminders(): Promise<AutomatedReminder[]> {
  const { data: po } = await supabase.from('purchase_orders').select('id, order_number, status, suppliers(id, company_name, whatsapp, contact_person)').eq('is_deleted', false).eq('status', 'Pending');
  const { data: so } = await supabase.from('sales_orders').select('id, order_number, status, customers(id, company_name, whatsapp, contact_person)').eq('is_deleted', false).eq('status', 'Pending');

  const reminders: AutomatedReminder[] = [];

  if (po) {
    po.forEach((order: any) => {
      const supplier = order.suppliers;
      if (!supplier) return;
      const contactName = supplier.contact_person || supplier.company_name;
      const msg = `Hello ${contactName},\n\nCould we get an update on the status of Purchase Order ${order.order_number}?\n\nRegards,\nRainbow Digital Solutions`;

      reminders.push({
        id: `po-${order.id}`,
        type: 'Order',
        title: `Pending PO: ${order.order_number}`,
        description: `PO for supplier ${supplier.company_name} is still Pending.`,
        reference_type: 'PurchaseOrder',
        reference_id: order.id,
        whatsapp_number: supplier.whatsapp || null,
        whatsapp_template: msg,
        priority: 'Medium',
        status: 'Pending',
      });
    });
  }

  if (so) {
    so.forEach((order: any) => {
      const customer = order.customers;
      if (!customer) return;
      const contactName = customer.contact_person || customer.company_name;
      const msg = `Hello ${contactName},\n\nYour Sales Order ${order.order_number} is being processed and is currently in Pending status. We will notify you once it is dispatched.\n\nRegards,\nRainbow Digital Solutions`;

      reminders.push({
        id: `so-${order.id}`,
        type: 'Order',
        title: `Pending SO: ${order.order_number}`,
        description: `SO for customer ${customer.company_name} is still Pending.`,
        reference_type: 'SalesOrder',
        reference_id: order.id,
        whatsapp_number: customer.whatsapp || null,
        whatsapp_template: msg,
        priority: 'Low', // usually we don't need to chase our own sales orders as aggressively as POs
        status: 'Pending',
      });
    });
  }

  return reminders.sort((a, b) => {
    if (a.reference_type === 'PurchaseOrder' && b.reference_type === 'SalesOrder') return -1;
    if (a.reference_type === 'SalesOrder' && b.reference_type === 'PurchaseOrder') return 1;
    return 0;
  });
}
