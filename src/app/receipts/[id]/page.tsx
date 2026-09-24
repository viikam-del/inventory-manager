'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    if (!confirm('Permanently delete this Goods Receipt (GRN)?')) return;
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
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <Icons.refresh className="animate-spin h-10 w-10 text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading goods receipt details...</p>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-destructive/20 text-center p-6 space-y-4">
          <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Receipt Not Found</h2>
          <p className="text-muted-foreground text-sm">{error || 'The requested goods receipt note could not be located.'}</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/receipts">
              <Icons.back className="w-4 h-4 mr-2" /> Back to Receipts
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const subtotal = lines.reduce((acc, l) => acc + (l.quantity_received * l.unit_cost), 0);
  const totalGst = lines.reduce((acc, l) => acc + (l.gst_amount || 0), 0);
  const grandTotal = subtotal + totalGst + Number(receipt.delivery_charges || 0);

  return (
    <div className="space-y-6 animate-in slide-up">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/receipts" className="text-muted-foreground hover:text-foreground text-sm font-medium inline-flex items-center gap-1 mb-2 print:hidden">
            <Icons.back className="w-4 h-4" /> Back to Receipts (GRN)
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{receipt.receipt_number}</h1>
            <Badge variant="success">
              <Icons.success className="w-3 h-3 mr-1" /> {receipt.status}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Icons.print className="w-4 h-4 mr-2" /> Print / PDF
          </Button>

          <Button variant="outline" size="sm" asChild className="bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 border-[#25D366]/30">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`*Goods Receipt (GRN): ${receipt.receipt_number}*\nSupplier: ${receipt.suppliers?.company_name || 'Direct Procurement'}\nTotal: ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nDate: ${new Date(receipt.receipt_date).toLocaleDateString('en-IN')}\n\n*Items Received:*\n${lines.map(l => `• ${l.quantity_received}x ${l.products?.name}`).join('\n')}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icons.share className="w-4 h-4 mr-1.5" /> WhatsApp
            </a>
          </Button>

          <Button size="sm" variant="destructive" onClick={handleDeleteReceipt} disabled={actionLoading}>
            <Icons.trash className="w-4 h-4 mr-1.5" /> Delete GRN
          </Button>
        </div>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.suppliers className="w-4 h-4 text-primary" /> Procurement Source
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Supplier:</span>
              <span className="font-semibold text-foreground">{receipt.suppliers?.company_name || 'Direct Procurement'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Originating PO:</span>
              <span className="font-medium text-foreground">
                {receipt.purchase_orders?.po_number ? (
                  <Link href={`/purchase-orders/${receipt.purchase_order_id}`} className="text-primary hover:underline font-mono">
                    {receipt.purchase_orders.po_number}
                  </Link>
                ) : 'None (Direct GRN)'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.delivery className="w-4 h-4 text-primary" /> Inbound Logistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Received Date:</span>
              <span className="font-medium text-foreground">{new Date(receipt.receipt_date).toLocaleDateString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Delivery / Inbound Charges:</span>
              <span className="font-semibold text-foreground">₹{Number(receipt.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Received Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.in className="w-5 h-5 text-primary" /> Items Added to Stock
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted border-b text-muted-foreground font-medium">
              <tr>
                <th className="px-6 py-3">Product Name</th>
                <th className="px-6 py-3">SKU</th>
                <th className="px-6 py-3 text-right">Qty Received</th>
                <th className="px-6 py-3 text-right">Unit Cost</th>
                <th className="px-6 py-3 text-right">Input GST</th>
                <th className="px-6 py-3 text-right">Total Line Cost</th>
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
                  <td className="px-6 py-4 text-right font-bold text-success">
                    +{l.quantity_received} <span className="text-xs font-normal text-muted-foreground">{l.products?.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-muted-foreground">
                    ₹{Number(l.unit_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right text-muted-foreground">
                    ₹{Number(l.gst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-foreground">
                    ₹{(Number(l.quantity_received * l.unit_cost) + Number(l.gst_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
            Total Input GST: <span className="font-semibold text-foreground">₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          {Number(receipt.delivery_charges) > 0 && (
            <div className="text-sm text-muted-foreground">
              Freight Charges: <span className="font-semibold text-foreground">₹{Number(receipt.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="text-xl font-black text-foreground pt-2 border-t border-border inline-block">
            Total Valuation: ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </Card>

      {/* Notes */}
      {receipt.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              GRN Inspection Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{receipt.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
