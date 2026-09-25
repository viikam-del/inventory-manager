'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

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

  const getStatusBadge = (status: SalesOrder['status']) => {
    switch (status) {
      case 'Invoiced':
        return <Badge variant="info" className="gap-1"><Icons.document className="w-3 h-3" /> Invoiced</Badge>;
      case 'Delivered':
        return <Badge variant="success" className="gap-1"><Icons.delivered className="w-3 h-3" /> Delivered</Badge>;
      case 'Partially Delivered':
        return <Badge variant="warning" className="gap-1"><Icons.delivery className="w-3 h-3" /> Partial</Badge>;
      case 'Confirmed':
        return <Badge variant="default" className="gap-1"><Icons.success className="w-3 h-3" /> Confirmed</Badge>;
      case 'Draft':
        return <Badge variant="secondary" className="gap-1"><Icons.document className="w-3 h-3" /> Draft</Badge>;
      case 'Cancelled':
        return <Badge variant="destructive" className="gap-1"><Icons.close className="w-3 h-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading sales order details...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !order) {
    return (
      <PageContainer>
        <div className="max-w-md mx-auto py-12">
          <Card className="border-destructive/30 text-center p-6 space-y-4">
            <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Order Not Found</h2>
            <p className="text-muted-foreground text-xs">{error || 'The requested order could not be located.'}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/sales-orders">
                <Icons.back className="w-4 h-4 mr-2" /> Back to Sales Orders
              </Link>
            </Button>
          </Card>
        </div>
      </PageContainer>
    );
  }

  const subtotal = lines.reduce((acc, l) => acc + (l.quantity * l.unit_price), 0);
  const totalGst = lines.reduce((acc, l) => acc + (l.gst_amount || 0), 0);
  const grandTotal = subtotal + totalGst + Number(order.delivery_charges || 0);

  return (
    <PageContainer>
      <PageHeader
        title={order.order_number}
        description={`Placed on ${new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} for ${order.customers?.company_name || 'Client'}`}
        badge={getStatusBadge(order.status)}
        backHref="/sales-orders"
        backLabel="Back to Orders"
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 text-xs">
              <Icons.print className="w-3.5 h-3.5 mr-1.5" /> Print / PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 text-xs bg-[#25D366]/10 text-[#128C7E] dark:text-[#25D366] hover:bg-[#25D366]/20 border-[#25D366]/30"
            >
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`*Sales Order: ${order.order_number}*\nStatus: ${order.status}\nCustomer: ${order.customers?.company_name || 'N/A'}\nTotal: ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nDate: ${new Date(order.order_date).toLocaleDateString('en-IN')}\n\n*Items:*\n${lines.map(l => `• ${l.quantity}x ${l.products?.name}`).join('\n')}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icons.share className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
              </a>
            </Button>

            {order.status === 'Draft' && (
              <Button size="sm" variant="default" onClick={handleConfirmOrder} disabled={actionLoading} className="h-8 text-xs">
                <Icons.success className="w-3.5 h-3.5 mr-1.5" /> Confirm Order
              </Button>
            )}

            {(order.status === 'Confirmed' || order.status === 'Partially Delivered') && (
              <Button size="sm" variant="success" onClick={handleMarkDelivered} disabled={actionLoading} className="h-8 text-xs">
                <Icons.delivered className="w-3.5 h-3.5 mr-1.5" /> Mark Delivered
              </Button>
            )}

            <Button size="sm" variant="secondary" onClick={() => setShowTallyModal(true)} className="h-8 text-xs">
              <Icons.document className="w-3.5 h-3.5 mr-1.5" />
              {order.tally_invoice_number ? `Tally: ${order.tally_invoice_number}` : 'Link Tally Invoice'}
            </Button>

            {order.status !== 'Delivered' && order.status !== 'Invoiced' && order.status !== 'Cancelled' && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelOrder}
                disabled={actionLoading}
                className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                Cancel
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeleteOrder}
              disabled={actionLoading}
              className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Icons.trash className="w-3.5 h-3.5" />
            </Button>
          </div>
        }
      />

      {/* Delivered but not invoiced alert */}
      {order.status === 'Delivered' && !order.tally_invoice_number && (
        <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Icons.warning className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">Goods Delivered — Pending Tally Invoicing</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Inventory decremented. Please record official Tally Invoice # when issued.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setShowTallyModal(true)}
              className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs"
            >
              Enter Invoice #
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Icons.customers className="w-4 h-4 text-primary" /> Customer Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <p className="text-base font-bold text-foreground">
              {order.customers?.id ? (
                <Link href={`/customers/${order.customers.id}`} className="hover:text-primary hover:underline">
                  {order.customers.company_name}
                </Link>
              ) : 'Unknown Customer'}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icons.phone className="w-3.5 h-3.5" /> {order.customers?.phone || '—'}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icons.email className="w-3.5 h-3.5" /> {order.customers?.email || '—'}
            </div>
            <div className="pt-2 border-t border-border/40 text-xs flex justify-between items-center">
              <span className="text-muted-foreground">Billing Classification:</span>
              <Badge variant={order.customers?.is_gst_customer ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                {order.customers?.is_gst_customer ? 'GST Registered' : 'Cash / Non-GST'}
              </Badge>
            </div>
            {order.customers?.gstin && (
              <div className="text-xs flex justify-between items-center font-mono">
                <span className="text-muted-foreground">GSTIN:</span>
                <span className="font-bold text-foreground">{order.customers.gstin}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Icons.delivery className="w-4 h-4 text-primary" /> Dispatch & Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Order Date:</span>
              <span className="font-medium text-foreground">
                {new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Expected Delivery:</span>
              <span className="font-medium text-foreground">
                {order.delivery_date
                  ? new Date(order.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Standard Schedule'}
              </span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">Site Address:</span>
              <span className="font-medium text-foreground text-right max-w-[240px]">
                {order.delivery_address || 'Registered Billing Address'}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border/40">
              <span className="text-muted-foreground">Delivery Charges:</span>
              <span className="font-semibold font-mono text-foreground">
                ₹{Number(order.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Lines Table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Icons.inventory className="w-4 h-4 text-primary" /> Order Items ({lines.length})
          </CardTitle>
          <CardDescription className="text-xs">Bill of materials, allocated SKU quantities, and rate breakdown</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-muted/60 border-b border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Product Name</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3 text-right">Unit Price</th>
                <th className="px-5 py-3 text-right">GST</th>
                <th className="px-5 py-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {lines.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-foreground">
                    {l.products?.name || 'Unknown Product'}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">
                    {l.products?.sku_code || '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold font-mono">
                    {l.quantity} <span className="text-[10px] font-normal text-muted-foreground uppercase">{l.products?.unit}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-muted-foreground font-mono">
                    ₹{Number(l.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right text-muted-foreground font-mono">
                    ₹{Number(l.gst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold font-mono text-foreground">
                    ₹{(Number(l.quantity * l.unit_price) + Number(l.gst_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="p-5 bg-muted/20 border-t border-border/50 flex flex-col items-end space-y-1.5">
          <div className="flex items-center justify-between w-64 text-xs text-muted-foreground">
            <span>Subtotal:</span>
            <span className="font-mono font-medium text-foreground">
              ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between w-64 text-xs text-muted-foreground">
            <span>Total GST:</span>
            <span className="font-mono font-medium text-foreground">
              ₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          {Number(order.delivery_charges) > 0 && (
            <div className="flex items-center justify-between w-64 text-xs text-muted-foreground">
              <span>Freight / Delivery:</span>
              <span className="font-mono font-medium text-foreground">
                ₹{Number(order.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between w-64 text-sm font-bold border-t border-border/60 pt-2 text-foreground">
            <span>Grand Total:</span>
            <span className="font-mono text-primary text-base">
              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Order Notes & Commercial Conditions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Modal for Tally Invoice Input */}
      <Modal
        isOpen={showTallyModal}
        onClose={() => setShowTallyModal(false)}
        title="Record Tally ERP / Prime Invoice #"
      >
        <form onSubmit={handleSaveTallyInvoice} className="space-y-4 pt-1">
          <p className="text-xs text-muted-foreground">
            Link the official tax voucher number from Tally to sync accounts and complete order audit.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tally Voucher #</label>
            <input
              type="text"
              placeholder="e.g. RDS/2026-27/0412"
              value={tallyInvoiceInput}
              onChange={e => setTallyInvoiceInput(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowTallyModal(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Link Invoice'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
