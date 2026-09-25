'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

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
    if (!confirm('Delete this Purchase Order? This will move it to the archive.')) return;
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
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading purchase order details...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !po) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Card className="max-w-md w-full border-destructive/20 text-center p-6 space-y-4">
            <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-bold">Purchase Order Not Found</h2>
            <p className="text-muted-foreground text-xs">{error || 'The requested purchase order could not be located.'}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/purchase-orders">
                <Icons.back className="w-4 h-4 mr-2" /> Back to Purchase Orders
              </Link>
            </Button>
          </Card>
        </div>
      </PageContainer>
    );
  }

  const subtotal = lines.reduce((acc, l) => acc + (l.quantity * l.unit_cost), 0);
  const totalGst = lines.reduce((acc, l) => acc + (l.gst_amount || 0), 0);
  const grandTotal = subtotal + totalGst + Number(po.delivery_charges || 0);

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'Received':
        return <Badge variant="success" className="gap-1"><Icons.success className="w-3 h-3" /> Received</Badge>;
      case 'Partially Received':
        return <Badge variant="warning" className="gap-1"><Icons.in className="w-3 h-3" /> Partial Receipt</Badge>;
      case 'Ordered':
        return <Badge variant="info" className="gap-1"><Icons.document className="w-3 h-3" /> Ordered</Badge>;
      case 'Cancelled':
        return <Badge variant="destructive" className="gap-1"><Icons.close className="w-3 h-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const whatsappMessage = encodeURIComponent(
    `*Purchase Order: ${po.po_number}*\nStatus: ${po.status}\nSupplier: ${po.suppliers?.company_name || 'N/A'}\nTotal: ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nDate: ${new Date(po.order_date).toLocaleDateString('en-IN')}\n\n*Ordered Items:*\n${lines.map(l => `• ${l.quantity}x ${l.products?.name}`).join('\n')}`
  );

  return (
    <PageContainer>
      <PageHeader
        title={po.po_number}
        description={`Procurement order issued to ${po.suppliers?.company_name || 'Supplier'}`}
        backHref="/purchase-orders"
        badge={getStatusBadge(po.status)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 gap-1.5 text-xs">
              <Icons.print className="w-3.5 h-3.5" /> Print / PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1.5 text-xs bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 border-[#25D366]/30 dark:bg-[#25D366]/15 dark:text-[#25D366]"
            >
              <a
                href={`https://wa.me/?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icons.share className="w-3.5 h-3.5" /> Share WhatsApp
              </a>
            </Button>

            {po.status !== 'Received' && po.status !== 'Cancelled' && (
              <>
                <Button size="sm" variant="success" asChild className="h-8 gap-1.5 text-xs">
                  <Link href={`/receipts/new?po_id=${po.id}`}>
                    <Icons.in className="w-3.5 h-3.5" /> Receive Stock (GRN)
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelPO}
                  disabled={actionLoading}
                  className="h-8 text-xs text-destructive border-destructive/20 hover:bg-destructive/10"
                >
                  Cancel
                </Button>
              </>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeletePO}
              disabled={actionLoading}
              className="h-8 text-xs text-muted-foreground hover:text-destructive"
            >
              <Icons.trash className="w-3.5 h-3.5" />
            </Button>
          </div>
        }
      />

      {/* Meta Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Supplier Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.suppliers className="w-4 h-4 text-primary" /> Supplier Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <p className="text-base font-bold text-foreground">{po.suppliers?.company_name || 'Unknown Supplier'}</p>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Icons.phone className="w-3.5 h-3.5 shrink-0" />
              <span>{po.suppliers?.phone || 'No phone provided'}</span>
            </div>
            {po.suppliers?.email && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Icons.email className="w-3.5 h-3.5 shrink-0" />
                <span>{po.suppliers.email}</span>
              </div>
            )}
            {po.suppliers?.gstin && (
              <div className="text-xs flex justify-between font-mono pt-2 border-t border-border/60">
                <span className="text-muted-foreground">GSTIN:</span>
                <span className="font-semibold text-foreground">{po.suppliers.gstin}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logistics Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.delivery className="w-4 h-4 text-primary" /> Logistics & Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order Date:</span>
              <span className="font-medium text-foreground">
                {new Date(po.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expected Delivery:</span>
              <span className="font-medium text-foreground">
                {po.expected_delivery_date
                  ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Not specified'}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border/60">
              <span className="text-muted-foreground">Freight Charges:</span>
              <span className="font-mono font-semibold text-foreground">
                ₹{Number(po.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Lines Table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Icons.inventory className="w-4 h-4 text-primary" /> Line Items ({lines.length})
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-muted/60 border-y border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Product Name</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3 text-right">Unit Cost</th>
                <th className="px-5 py-3 text-right">Input GST</th>
                <th className="px-5 py-3 text-right">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {lines.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-foreground">
                    {l.products?.name || 'Unknown Product'}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">
                    {l.products?.sku_code || '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-foreground">
                    {l.quantity} <span className="text-xs font-normal text-muted-foreground">{l.products?.unit}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                    ₹{Number(l.unit_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                    ₹{Number(l.gst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-foreground">
                    ₹{(Number(l.quantity * l.unit_cost) + Number(l.gst_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="p-4 sm:p-6 bg-muted/20 border-t border-border/60 flex flex-col items-end space-y-1.5 text-xs sm:text-sm">
          <div className="flex justify-between w-full max-w-xs text-muted-foreground">
            <span>Items Subtotal:</span>
            <span className="font-mono font-medium text-foreground">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between w-full max-w-xs text-muted-foreground">
            <span>Total Input GST (ITC):</span>
            <span className="font-mono font-medium text-foreground">₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          {Number(po.delivery_charges) > 0 && (
            <div className="flex justify-between w-full max-w-xs text-muted-foreground">
              <span>Freight Charges:</span>
              <span className="font-mono font-medium text-foreground">₹{Number(po.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between w-full max-w-xs pt-2 border-t border-border text-base font-bold text-foreground">
            <span>Grand Total:</span>
            <span className="font-mono text-primary">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </Card>

      {/* Notes Card */}
      {po.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Purchase Order Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{po.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Goods Received Notes (GRN) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Icons.receipts className="w-4 h-4 text-primary" /> Goods Received Notes (GRN)
            </CardTitle>
            <CardDescription className="text-xs">Incoming shipments received against this purchase order</CardDescription>
          </div>
          {po.status !== 'Received' && po.status !== 'Cancelled' && (
            <Button size="sm" variant="outline" asChild className="h-8 gap-1 text-xs">
              <Link href={`/receipts/new?po_id=${po.id}`}>
                <Icons.add className="w-3.5 h-3.5" /> Create GRN
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {receipts.length > 0 ? (
            <div className="divide-y divide-border/60 border-t border-border/60">
              {receipts.map((r) => (
                <div key={r.id} className="py-3 flex justify-between items-center text-xs sm:text-sm">
                  <div>
                    <span className="font-mono font-bold text-foreground">{r.receipt_number}</span>
                    <span className="text-xs text-muted-foreground ml-3">
                      {new Date(r.receipt_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success" className="text-[10px]">{r.status}</Badge>
                    <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                      <Link href={`/receipts/${r.id}`}>
                        View Details <Icons.forward className="w-3 h-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-xs italic">No goods receipt notes recorded for this purchase order yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
