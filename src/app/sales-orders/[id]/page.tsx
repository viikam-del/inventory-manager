'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';

interface OrderLine {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  gst_amount: number;
  total_amount: number;
  products?: {
    name: string;
    sku_code: string;
    unit: string;
  };
}

interface SalesOrder {
  id: string;
  order_number: string;
  customer_id: string;
  order_date: string;
  delivery_date: string | null;
  delivery_address: string | null;
  delivery_contact_person: string | null;
  delivery_contact_phone: string | null;
  delivery_charges: number;
  notes: string | null;
  status: 'Draft' | 'Confirmed' | 'Partially Delivered' | 'Delivered' | 'Invoiced' | 'Cancelled';
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  tally_invoice_number: string | null;
  created_at: string;
  customers?: {
    id: string;
    company_name: string;
    phone: string;
    email: string | null;
    gstin: string | null;
    is_gst_customer: boolean;
  };
}

export default function SalesOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [tallyInvoiceInput, setTallyInvoiceInput] = useState('');
  const [showTallyModal, setShowTallyModal] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
  }, [params.id]);

  async function fetchOrderDetails() {
    setLoading(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('sales_orders')
        .select('*, customers(id, company_name, phone, email, gstin, is_gst_customer)')
        .eq('id', params.id)
        .eq('is_deleted', false)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData);
      setTallyInvoiceInput(orderData.tally_invoice_number || '');

      const { data: linesData, error: linesError } = await supabase
        .from('sales_order_lines')
        .select('*, products(name, sku_code, unit)')
        .eq('sales_order_id', params.id);

      if (linesError) throw linesError;
      setLines(linesData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }

  // Fulfill / Mark as Delivered and decrement inventory
  const handleMarkDelivered = async () => {
    if (!order) return;
    if (!confirm('Marking as Delivered will reduce current stock levels in inventory. Continue?')) return;

    setActionLoading(true);
    try {
      // 1. Decrement product stock and create stock adjustment audit
      for (const line of lines) {
        const { data: prodData } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', line.product_id)
          .single();

        const currentStock = Number(prodData?.current_stock) || 0;
        const newStock = currentStock - Number(line.quantity);

        await supabase
          .from('products')
          .update({ current_stock: newStock })
          .eq('id', line.product_id);

        await supabase
          .from('stock_adjustments')
          .insert([{
            product_id: line.product_id,
            adjustment_type: 'Out',
            quantity: line.quantity,
            reason: `Sales Order fulfillment: ${order.order_number}`,
            reference_type: 'SalesOrder',
            reference_id: order.id
          }]);
      }

      // 2. Update order status
      const { error: updateError } = await supabase
        .from('sales_orders')
        .update({ status: 'Delivered' })
        .eq('id', order.id);

      if (updateError) throw updateError;

      setOrder(prev => prev ? { ...prev, status: 'Delivered' } : null);
    } catch (err: any) {
      alert(err.message || 'Failed to mark as delivered');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Tally Invoice Number and set status to Invoiced
  const handleSaveTallyInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setActionLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('sales_orders')
        .update({
          tally_invoice_number: tallyInvoiceInput.trim() || null,
          status: tallyInvoiceInput.trim() ? 'Invoiced' : order.status
        })
        .eq('id', order.id);

      if (updateError) throw updateError;

      setOrder(prev => prev ? {
        ...prev,
        tally_invoice_number: tallyInvoiceInput.trim() || null,
        status: tallyInvoiceInput.trim() ? 'Invoiced' : prev.status
      } : null);

      setShowTallyModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update Tally invoice number');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!confirm('Are you sure you want to cancel this Sales Order?')) return;
    try {
      const { error: cancelError } = await supabase
        .from('sales_orders')
        .update({ status: 'Cancelled' })
        .eq('id', params.id);

      if (cancelError) throw cancelError;
      setOrder(prev => prev ? { ...prev, status: 'Cancelled' } : null);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel order');
    }
  };

  const handleConfirmOrder = async () => {
    if (!confirm('Confirm this order?')) return;
    setActionLoading(true);
    try {
      const { error: confirmError } = await supabase
        .from('sales_orders')
        .update({ status: 'Confirmed' })
        .eq('id', params.id);

      if (confirmError) throw confirmError;
      setOrder(prev => prev ? { ...prev, status: 'Confirmed' } : null);
    } catch (err: any) {
      alert(err.message || 'Failed to confirm order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!confirm('Permanently delete this Sales Order?')) return;
    setActionLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('sales_orders')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', params.id);

      if (deleteError) throw deleteError;
      router.push('/sales-orders');
    } catch (err: any) {
      alert(err.message || 'Failed to delete order');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <Icons.refresh className="animate-spin h-10 w-10 text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading sales order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-destructive/20 text-center p-6 space-y-4">
          <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Order Not Found</h2>
          <p className="text-muted-foreground text-sm">{error || 'The requested order could not be located.'}</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/sales-orders">
              <Icons.back className="w-4 h-4 mr-2" /> Back to Sales Orders
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const subtotal = lines.reduce((acc, l) => acc + (l.quantity * l.unit_price), 0);
  const totalGst = lines.reduce((acc, l) => acc + (l.gst_amount || 0), 0);
  const grandTotal = subtotal + totalGst + Number(order.delivery_charges || 0);

  const getStatusBadge = (status: SalesOrder['status']) => {
    switch (status) {
      case 'Invoiced': return <Badge variant="success"><Icons.success className="w-3 h-3 mr-1" /> Invoiced</Badge>;
      case 'Delivered': return <Badge variant="info"><Icons.delivered className="w-3 h-3 mr-1" /> Delivered</Badge>;
      case 'Partially Delivered': return <Badge variant="warning"><Icons.delivery className="w-3 h-3 mr-1" /> Partial Delivery</Badge>;
      case 'Confirmed': return <Badge variant="default"><Icons.success className="w-3 h-3 mr-1" /> Confirmed</Badge>;
      case 'Draft': return <Badge variant="secondary"><Icons.document className="w-3 h-3 mr-1" /> Draft</Badge>;
      case 'Cancelled': return <Badge variant="destructive"><Icons.close className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in slide-up">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/sales-orders" className="text-muted-foreground hover:text-foreground text-sm font-medium inline-flex items-center gap-1 mb-2 print:hidden">
            <Icons.back className="w-4 h-4" /> Back to Sales Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{order.order_number}</h1>
            {getStatusBadge(order.status)}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Icons.print className="w-4 h-4 mr-2" /> Print / PDF
          </Button>

          <Button variant="outline" size="sm" asChild className="bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 border-[#25D366]/30">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`*Sales Order: ${order.order_number}*\nStatus: ${order.status}\nCustomer: ${order.customers?.company_name || 'N/A'}\nTotal: ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nDate: ${new Date(order.order_date).toLocaleDateString('en-IN')}\n\n*Items:*\n${lines.map(l => `• ${l.quantity}x ${l.products?.name}`).join('\n')}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icons.share className="w-4 h-4 mr-1.5" /> WhatsApp
            </a>
          </Button>

          {order.status === 'Draft' && (
            <Button size="sm" variant="default" onClick={handleConfirmOrder} disabled={actionLoading}>
              <Icons.success className="w-4 h-4 mr-1.5" /> Confirm Order
            </Button>
          )}

          {(order.status === 'Confirmed' || order.status === 'Partially Delivered') && (
            <Button size="sm" variant="success" onClick={handleMarkDelivered} disabled={actionLoading}>
              <Icons.delivered className="w-4 h-4 mr-1.5" /> Mark Delivered
            </Button>
          )}

          <Button size="sm" variant="secondary" onClick={() => setShowTallyModal(true)}>
            <Icons.document className="w-4 h-4 mr-1.5" />
            {order.tally_invoice_number ? `Tally Inv: ${order.tally_invoice_number}` : 'Link Tally Invoice'}
          </Button>

          {order.status !== 'Delivered' && order.status !== 'Invoiced' && order.status !== 'Cancelled' && (
            <Button size="sm" variant="outline" onClick={handleCancelOrder} disabled={actionLoading} className="text-destructive border-destructive/20 hover:bg-destructive/10">
              Cancel
            </Button>
          )}

          <Button size="sm" variant="destructive" onClick={handleDeleteOrder} disabled={actionLoading}>
            <Icons.trash className="w-4 h-4 mr-1.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Delivered but not invoiced alert */}
      {order.status === 'Delivered' && !order.tally_invoice_number && (
        <Card className="bg-warning/10 border-warning/30">
          <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Icons.warning className="w-6 h-6 text-warning shrink-0" />
              <div>
                <p className="font-bold text-warning-foreground">Goods Delivered — Pending Tally Invoicing</p>
                <p className="text-xs text-warning-foreground/80">Inventory decremented. Please record official Tally Invoice # when issued.</p>
              </div>
            </div>
            <Button size="sm" variant="warning" onClick={() => setShowTallyModal(true)} className="shrink-0 font-bold">
              Enter Invoice #
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.customers className="w-4 h-4 text-primary" /> Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lg font-bold text-foreground">
              {order.customers?.id ? (
                <Link href={`/customers/${order.customers.id}`} className="hover:text-primary hover:underline">
                  {order.customers.company_name}
                </Link>
              ) : 'Unknown Customer'}
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icons.phone className="w-4 h-4" /> {order.customers?.phone || '—'}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icons.email className="w-4 h-4" /> {order.customers?.email || '—'}
            </div>
            <div className="pt-2 border-t text-sm flex justify-between">
              <span className="text-muted-foreground">Billing Mode:</span>
              <span className="font-semibold text-foreground">{order.customers?.is_gst_customer ? 'Registered GST Customer' : 'Cash / Non-GST'}</span>
            </div>
            {order.customers?.gstin && (
              <div className="text-sm flex justify-between font-mono">
                <span className="text-muted-foreground">GSTIN:</span>
                <span className="font-bold">{order.customers.gstin}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.delivery className="w-4 h-4 text-primary" /> Delivery & Logistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order Date:</span>
              <span className="font-medium text-foreground">{new Date(order.order_date).toLocaleDateString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Expected Delivery:</span>
              <span className="font-medium text-foreground">
                {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-IN') : 'Standard Delivery'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery Address:</span>
              <span className="font-medium text-foreground text-right">{order.delivery_address || 'Same as Billing'}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Delivery Charges:</span>
              <span className="font-semibold text-foreground">₹{Number(order.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Lines Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.inventory className="w-5 h-5 text-primary" /> Order Items & Line Summary
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted border-b text-muted-foreground font-medium">
              <tr>
                <th className="px-6 py-3">Product Name</th>
                <th className="px-6 py-3">SKU</th>
                <th className="px-6 py-3 text-right">Quantity</th>
                <th className="px-6 py-3 text-right">Unit Price</th>
                <th className="px-6 py-3 text-right">GST</th>
                <th className="px-6 py-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((l) => (
                <tr key={l.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-foreground">
                    {l.products?.name || 'Unknown Product'}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                    {l.products?.sku_code || '—'}
                  </td>
                  <td className="px-6 py-4 text-right font-bold">
                    {l.quantity} <span className="text-xs font-normal text-muted-foreground">{l.products?.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-muted-foreground">
                    ₹{Number(l.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right text-muted-foreground">
                    ₹{Number(l.gst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-foreground">
                    ₹{(Number(l.quantity * l.unit_price) + Number(l.gst_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="p-6 bg-muted/30 border-t space-y-2 text-right">
          <div className="text-sm text-muted-foreground">
            Subtotal: <span className="font-semibold text-foreground">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Total Output GST: <span className="font-semibold text-foreground">₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          {Number(order.delivery_charges) > 0 && (
            <div className="text-sm text-muted-foreground">
              Delivery Fee: <span className="font-semibold text-foreground">₹{Number(order.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="text-xl font-black text-foreground pt-2 border-t border-border inline-block">
            Grand Total: ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Order Notes & Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Modal for Tally Invoice Input */}
      <Modal
        isOpen={showTallyModal}
        onClose={() => setShowTallyModal(false)}
        title="Record Tally Invoice Number"
      >
        <form onSubmit={handleSaveTallyInvoice} className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Provide official Tally ERP/Prime invoice number to link to this Sales Order.
          </p>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Invoice Reference</label>
            <input
              type="text"
              placeholder="e.g. RDS/2026-27/0412"
              value={tallyInvoiceInput}
              onChange={e => setTallyInvoiceInput(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md text-sm bg-background focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setShowTallyModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="default" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Link Invoice'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
