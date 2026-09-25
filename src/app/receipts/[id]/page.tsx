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

interface ReceiptLine {
  id: string;
  product_id: string;
  quantity_received: number;
  unit_cost: number;
  gst_amount: number;
  total_amount: number;
  products?: {
    name: string;
    sku_code: string;
    unit: string;
  };
}

interface Receipt {
  id: string;
  receipt_number: string;
  purchase_order_id: string | null;
  supplier_id: string | null;
  receipt_date: string;
  delivery_charges: number;
  notes: string | null;
  status: string;
  created_at: string;
  suppliers?: {
    company_name: string;
    phone: string;
  };
  purchase_orders?: {
    po_number: string;
  };
}

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDeleteReceipt = async () => {
    if (!confirm('Permanently delete this Goods Receipt (GRN)? This will move it to the archive.')) return;
    setActionLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('receipts')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', params.id);

      if (deleteError) throw deleteError;
      router.push('/receipts');
    } catch (err: any) {
      alert(err.message || 'Failed to delete receipt');
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchReceiptDetails();
  }, [params.id]);

  async function fetchReceiptDetails() {
    setLoading(true);
    try {
      const { data: receiptData, error: receiptError } = await supabase
        .from('receipts')
        .select('*, suppliers(company_name, phone), purchase_orders(po_number)')
        .eq('id', params.id)
        .eq('is_deleted', false)
        .single();

      if (receiptError) throw receiptError;
      setReceipt(receiptData);

      const { data: linesData, error: linesError } = await supabase
        .from('receipt_lines')
        .select('*, products(name, sku_code, unit)')
        .eq('receipt_id', params.id);

      if (linesError) throw linesError;
      setLines(linesData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load receipt');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading goods receipt details...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !receipt) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Card className="max-w-md w-full border-destructive/20 text-center p-6 space-y-4">
            <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-bold">Receipt Not Found</h2>
            <p className="text-muted-foreground text-xs">{error || 'The requested goods receipt note could not be located.'}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/receipts">
                <Icons.back className="w-4 h-4 mr-2" /> Back to Receipts
              </Link>
            </Button>
          </Card>
        </div>
      </PageContainer>
    );
  }

  const subtotal = lines.reduce((acc, l) => acc + (l.quantity_received * l.unit_cost), 0);
  const totalGst = lines.reduce((acc, l) => acc + (l.gst_amount || 0), 0);
  const grandTotal = subtotal + totalGst + Number(receipt.delivery_charges || 0);

  const whatsappMessage = encodeURIComponent(
    `*Goods Receipt (GRN): ${receipt.receipt_number}*\nStatus: ${receipt.status}\nSupplier: ${receipt.suppliers?.company_name || 'Direct Procurement'}\nTotal Valuation: ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nDate: ${new Date(receipt.receipt_date).toLocaleDateString('en-IN')}\n\n*Received Items:*\n${lines.map(l => `• ${l.quantity_received}x ${l.products?.name}`).join('\n')}`
  );

  return (
    <PageContainer>
      <PageHeader
        title={receipt.receipt_number}
        description={`Inbound shipment verified from ${receipt.suppliers?.company_name || 'Direct Procurement'}`}
        backHref="/receipts"
        badge={
          <Badge variant="success" className="gap-1">
            <Icons.success className="w-3 h-3" /> {receipt.status || 'Received'}
          </Badge>
        }
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

            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeleteReceipt}
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
        {/* Source Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.suppliers className="w-4 h-4 text-primary" /> Procurement Source
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Supplier:</span>
              <span className="font-semibold text-foreground">{receipt.suppliers?.company_name || 'Direct Procurement (No Vendor)'}</span>
            </div>
            {receipt.suppliers?.phone && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Contact:</span>
                <span className="font-medium text-foreground">{receipt.suppliers.phone}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border/60">
              <span className="text-muted-foreground">Originating PO:</span>
              <span className="font-medium text-foreground">
                {receipt.purchase_orders?.po_number ? (
                  <Link
                    href={`/purchase-orders/${receipt.purchase_order_id}`}
                    className="font-mono text-xs bg-muted/80 text-foreground px-2 py-0.5 rounded border border-border/60 hover:bg-muted transition-colors inline-block"
                  >
                    {receipt.purchase_orders.po_number}
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-xs italic">Direct GRN</span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Logistics Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.delivery className="w-4 h-4 text-primary" /> Inbound Logistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Received Date:</span>
              <span className="font-medium text-foreground">
                {new Date(receipt.receipt_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border/60">
              <span className="text-muted-foreground">Inbound Freight Charges:</span>
              <span className="font-mono font-semibold text-foreground">
                ₹{Number(receipt.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Received Table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Icons.in className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Items Credited to Stock ({lines.length})
          </CardTitle>
          <CardDescription className="text-xs">Physical quantities received and added to active warehouse inventory</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-muted/60 border-y border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Product Name</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3 text-right">Qty Received</th>
                <th className="px-5 py-3 text-right">Unit Cost</th>
                <th className="px-5 py-3 text-right">Input GST</th>
                <th className="px-5 py-3 text-right">Total Line Cost</th>
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
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +{l.quantity_received} <span className="text-xs font-normal text-muted-foreground">{l.products?.unit}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                    ₹{Number(l.unit_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                    ₹{Number(l.gst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-foreground">
                    ₹{(Number(l.quantity_received * l.unit_cost) + Number(l.gst_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
          {Number(receipt.delivery_charges) > 0 && (
            <div className="flex justify-between w-full max-w-xs text-muted-foreground">
              <span>Freight Charges:</span>
              <span className="font-mono font-medium text-foreground">₹{Number(receipt.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between w-full max-w-xs pt-2 border-t border-border text-base font-bold text-foreground">
            <span>Total Inbound Valuation:</span>
            <span className="font-mono text-primary">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </Card>

      {/* Notes */}
      {receipt.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Inspection Remarks & Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{receipt.notes}</p>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
