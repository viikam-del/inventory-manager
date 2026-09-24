'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface POLine {
  id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  gst_amount: number;
  total_amount: number;
  products?: {
    name: string;
    sku_code: string;
    unit: string;
  };
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  order_date: string;
  expected_delivery_date: string | null;
  delivery_charges: number;
  notes: string | null;
  status: 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled';
  created_at: string;
  suppliers?: {
    company_name: string;
    phone: string;
    email: string | null;
    gstin: string | null;
  };
}

interface Receipt {
  id: string;
  receipt_number: string;
  receipt_date: string;
  status: string;
  delivery_charges: number;
}

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [lines, setLines] = useState<POLine[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPODetails();
  }, [params.id]);

  async function fetchPODetails() {
    setLoading(true);
    try {
      // 1. Fetch PO with supplier
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(company_name, phone, email, gstin)')
        .eq('id', params.id)
        .eq('is_deleted', false)
        .single();

      if (poError) throw poError;
      setPo(poData);

      // 2. Fetch lines with products
      const { data: linesData, error: linesError } = await supabase
        .from('purchase_order_lines')
        .select('*, products(name, sku_code, unit)')
        .eq('purchase_order_id', params.id);

      if (linesError) throw linesError;
      setLines(linesData || []);

      // 3. Fetch associated goods receipts
      const { data: receiptsData, error: receiptsError } = await supabase
        .from('receipts')
        .select('*')
        .eq('purchase_order_id', params.id)
        .eq('is_deleted', false)
        .order('receipt_date', { ascending: false });

      if (!receiptsError) {
        setReceipts(receiptsData || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  }

  const handleCancelPO = async () => {
    if (!confirm('Are you sure you want to cancel this Purchase Order?')) return;
    setActionLoading(true);
    try {
      const { error: cancelError } = await supabase
        .from('purchase_orders')
        .update({ status: 'Cancelled' })
        .eq('id', params.id);

      if (cancelError) throw cancelError;
      setPo(prev => prev ? { ...prev, status: 'Cancelled' } : null);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePO = async () => {
    if (!confirm('Delete this Purchase Order?')) return;
    setActionLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('purchase_orders')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', params.id);

      if (deleteError) throw deleteError;
      router.push('/purchase-orders');
    } catch (err: any) {
      alert(err.message || 'Failed to delete PO');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <Icons.refresh className="animate-spin h-10 w-10 text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading purchase order details...</p>
        </div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-destructive/20 text-center p-6 space-y-4">
          <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Purchase Order Not Found</h2>
          <p className="text-muted-foreground text-sm">{error || 'The requested purchase order could not be located.'}</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/purchase-orders">
              <Icons.back className="w-4 h-4 mr-2" /> Back to Purchase Orders
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const subtotal = lines.reduce((acc, l) => acc + (l.quantity * l.unit_cost), 0);
  const totalGst = lines.reduce((acc, l) => acc + (l.gst_amount || 0), 0);
  const grandTotal = subtotal + totalGst + Number(po.delivery_charges || 0);

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'Received': return <Badge variant="success"><Icons.success className="w-3 h-3 mr-1" /> Received</Badge>;
      case 'Partially Received': return <Badge variant="warning"><Icons.in className="w-3 h-3 mr-1" /> Partial Receipt</Badge>;
      case 'Ordered': return <Badge variant="info"><Icons.document className="w-3 h-3 mr-1" /> Ordered</Badge>;
      case 'Cancelled': return <Badge variant="destructive"><Icons.close className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in slide-up">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/purchase-orders" className="text-muted-foreground hover:text-foreground text-sm font-medium inline-flex items-center gap-1 mb-2 print:hidden">
            <Icons.back className="w-4 h-4" /> Back to Purchase Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{po.po_number}</h1>
            {getStatusBadge(po.status)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Icons.print className="w-4 h-4 mr-2" /> Print / PDF
          </Button>

          <Button variant="outline" size="sm" asChild className="bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 border-[#25D366]/30">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`*Purchase Order: ${po.po_number}*\nStatus: ${po.status}\nSupplier: ${po.suppliers?.company_name || 'N/A'}\nTotal: ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nDate: ${new Date(po.order_date).toLocaleDateString('en-IN')}\n\n*Ordered Items:*\n${lines.map(l => `• ${l.quantity}x ${l.products?.name}`).join('\n')}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icons.share className="w-4 h-4 mr-1.5" /> WhatsApp
            </a>
          </Button>

          {po.status !== 'Received' && po.status !== 'Cancelled' && (
            <>
              <Button size="sm" variant="success" asChild>
                <Link href={`/receipts/new?po_id=${po.id}`}>
                  <Icons.in className="w-4 h-4 mr-1.5" /> Receive Stock (GRN)
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancelPO} disabled={actionLoading} className="text-destructive border-destructive/20 hover:bg-destructive/10">
                Cancel
              </Button>
            </>
          )}

          <Button size="sm" variant="destructive" onClick={handleDeletePO} disabled={actionLoading}>
            <Icons.trash className="w-4 h-4 mr-1.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.suppliers className="w-4 h-4 text-primary" /> Supplier Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lg font-bold text-foreground">{po.suppliers?.company_name || 'Unknown Supplier'}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icons.phone className="w-4 h-4" /> {po.suppliers?.phone || '—'}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icons.email className="w-4 h-4" /> {po.suppliers?.email || '—'}
            </div>
            {po.suppliers?.gstin && (
              <div className="text-sm flex justify-between font-mono pt-2 border-t">
                <span className="text-muted-foreground">GSTIN:</span>
                <span className="font-bold">{po.suppliers.gstin}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.delivery className="w-4 h-4 text-primary" /> Logistics & Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order Date:</span>
              <span className="font-medium text-foreground">{new Date(po.order_date).toLocaleDateString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Expected Delivery:</span>
              <span className="font-medium text-foreground">
                {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN') : 'Not specified'}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Freight Charges:</span>
              <span className="font-semibold text-foreground">₹{Number(po.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Lines */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.inventory className="w-5 h-5 text-primary" /> Purchase Order Lines
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted border-b text-muted-foreground font-medium">
              <tr>
                <th className="px-6 py-3">Product Name</th>
                <th className="px-6 py-3">SKU</th>
                <th className="px-6 py-3 text-right">Quantity</th>
                <th className="px-6 py-3 text-right">Unit Cost</th>
                <th className="px-6 py-3 text-right">Input GST</th>
                <th className="px-6 py-3 text-right">Total Cost</th>
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
                    ₹{Number(l.unit_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right text-muted-foreground">
                    ₹{Number(l.gst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-foreground">
                    ₹{(Number(l.quantity * l.unit_cost) + Number(l.gst_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
            Total Input GST (ITC): <span className="font-semibold text-foreground">₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          {Number(po.delivery_charges) > 0 && (
            <div className="text-sm text-muted-foreground">
              Freight / Charges: <span className="font-semibold text-foreground">₹{Number(po.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="text-xl font-black text-foreground pt-2 border-t border-border inline-block">
            Grand Total: ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </Card>

      {/* Notes */}
      {po.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Purchase Order Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{po.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Receipts Associated with this PO */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Icons.receipts className="w-5 h-5 text-primary" /> Goods Received Notes (GRN)
          </CardTitle>
          {po.status !== 'Received' && po.status !== 'Cancelled' && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/receipts/new?po_id=${po.id}`}>
                <Icons.add className="w-4 h-4 mr-1" /> Create GRN
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {receipts.length > 0 ? (
            <div className="divide-y border-t mt-2">
              {receipts.map((r) => (
                <div key={r.id} className="py-3 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-foreground">{r.receipt_number}</span>
                    <span className="text-xs text-muted-foreground ml-3">{new Date(r.receipt_date).toLocaleDateString('en-IN')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="success">{r.status}</Badge>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/receipts/${r.id}`}>
                        View Details <Icons.forward className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm italic py-4 text-center">No goods receipts recorded for this PO yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
