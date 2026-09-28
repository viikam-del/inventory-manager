'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

interface Product {
  id: string;
  name: string;
  sku_code: string;
  category: string;
  unit: string;
  hsn_code: string | null;
  gst_rate: number;
  price_gst: number;
  price_non_gst: number;
  current_stock: number;
  description: string | null;
}

interface LedgerEntry {
  id: string;
  date: string;
  type: string; // 'In' | 'Out'
  quantity: number;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;

  // Enriched fields
  display_type: string;
  reference_number: string;
  counterparty: string;
  running_balance: number;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    fetchProduct();
  }, [params.id]);

  async function fetchProduct() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .eq('is_deleted', false)
        .single();

      if (supabaseError) throw supabaseError;
      setProduct(data);
      if (data) fetchProductLedger(data.id);
    } catch (err: any) {
      setError(err.message || 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  }

  async function fetchProductLedger(productId: string) {
    setLedgerLoading(true);
    try {
      // 1. Fetch raw stock adjustments
      const { data: adjustments, error: adjError } = await supabase
        .from('stock_adjustments')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: true }); // chronological

      if (adjError) throw adjError;
      if (!adjustments || adjustments.length === 0) {
        setLedger([]);
        setLedgerLoading(false);
        return;
      }

      // 2. We need to enrich adjustments with receipt/sales order numbers and counterparties
      // Collect IDs
      const receiptIds = adjustments.filter((a: any) => a.reference_type === 'Receipt' && a.reference_id).map((a: any) => a.reference_id);
      const soIds = adjustments.filter((a: any) => a.reference_type === 'SalesOrder' && a.reference_id).map((a: any) => a.reference_id);

      // Fetch receipts (for purchases)
      const receiptsMap = new Map();
      if (receiptIds.length > 0) {
        const { data: receiptsData } = await supabase
          .from('receipts')
          .select('id, receipt_number, suppliers(company_name)')
          .in('id', receiptIds);

        if (receiptsData) {
          receiptsData.forEach((r: any) => {
            receiptsMap.set(r.id, {
              number: r.receipt_number,
              counterparty: r.suppliers?.company_name || 'Unknown Supplier'
            });
          });
        }
      }

      // Fetch Sales Orders
      const soMap = new Map();
      if (soIds.length > 0) {
        const { data: soData } = await supabase
          .from('sales_orders')
          .select('id, order_number, customers(company_name)')
          .in('id', soIds);

        if (soData) {
          soData.forEach((s: any) => {
            soMap.set(s.id, {
              number: s.order_number,
              counterparty: s.customers?.company_name || 'Unknown Customer'
            });
          });
        }
      }

      // 3. Map and enrich running balance
      let runningBalance = 0;

      const enrichedLedger: LedgerEntry[] = adjustments.map((adj: any) => {
        // Compute running balance based on in/out
        const qtyNum = Number(adj.quantity) || 0;
        const change = adj.adjustment_type === 'In' ? qtyNum : -qtyNum;
        runningBalance += change;

        let display_type = 'Manual Adjustment';
        let reference_number = adj.id.substring(0, 8); // fallback
        let counterparty = '-';

        if (adj.reference_type === 'Receipt') {
          display_type = 'Purchase Inbound';
          const rec = receiptsMap.get(adj.reference_id);
          if (rec) {
            reference_number = rec.number;
            counterparty = rec.counterparty;
          }
        } else if (adj.reference_type === 'SalesOrder') {
          display_type = 'Sale Outbound';
          const so = soMap.get(adj.reference_id);
          if (so) {
            reference_number = so.number;
            counterparty = so.counterparty;
          }
        } else if (adj.reference_type === 'Return') {
          display_type = 'Return';
          // Would fetch return number similarly if implemented
        }

        return {
          id: adj.id,
          date: adj.created_at,
          type: adj.adjustment_type,
          quantity: qtyNum,
          reason: adj.reason,
          reference_type: adj.reference_type,
          reference_id: adj.reference_id,
          display_type,
          reference_number,
          counterparty,
          running_balance: runningBalance
        };
      });

      // We reverse the array because typically users want to see newest entries at the top
      setLedger(enrichedLedger.reverse());

    } catch (err: any) {
      console.error('Failed to load product ledger', err);
    } finally {
      setLedgerLoading(false);
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    setActionLoading(true);
    try {
      const { error: supabaseError } = await supabase
        .from('products')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', params.id);

      if (supabaseError) throw supabaseError;
      router.push('/products');
    } catch (err: any) {
      alert(err.message || 'Failed to delete product');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading product details...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !product) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center px-4">
          <Card className="max-w-md w-full border-destructive/20 text-center p-6 space-y-4">
            <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-bold">Product Not Found</h2>
            <p className="text-muted-foreground text-xs">{error || 'The requested product could not be located.'}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/products">
                <Icons.back className="w-4 h-4 mr-2" /> Back to Products
              </Link>
            </Button>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={product.name}
        description={`Product Ledger & Details`}
        backHref="/products"
        badge={
          product.current_stock <= 0 ? (
            <Badge variant="destructive">Out of Stock</Badge>
          ) : product.current_stock < 10 ? (
            <Badge variant="warning">Low Stock</Badge>
          ) : (
            <Badge variant="success">In Stock</Badge>
          )
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs">
              <Link href={`/products/${product.id}/edit`}>
                <Icons.edit className="w-3.5 h-3.5" /> Edit Product
              </Link>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={actionLoading}
              className="h-8 text-xs text-muted-foreground hover:text-destructive"
            >
              <Icons.trash className="w-3.5 h-3.5" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Basic Info */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex flex-col gap-1 border-b border-border/50 pb-2">
                <span className="text-xs text-muted-foreground">SKU / Item Code</span>
                <span className="font-mono font-medium">{product.sku_code || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 border-b border-border/50 pb-2">
                <span className="text-xs text-muted-foreground">Category</span>
                <span className="font-medium">{product.category || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 border-b border-border/50 pb-2">
                <span className="text-xs text-muted-foreground">Unit of Measure</span>
                <span className="font-medium">{product.unit || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 border-b border-border/50 pb-2">
                <span className="text-xs text-muted-foreground">HSN Code</span>
                <span className="font-mono">{product.hsn_code || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 border-b border-border/50 pb-2">
                <span className="text-xs text-muted-foreground">GST Rate</span>
                <span className="font-medium">{product.gst_rate}%</span>
              </div>
              <div className="flex flex-col gap-1 col-span-2 sm:col-span-3">
                <span className="text-xs text-muted-foreground">Description</span>
                <span className="text-muted-foreground">{product.description || 'No description provided.'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Info & Stock */}
        <div className="space-y-4 sm:space-y-6 flex flex-col">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Current Stock</p>
                <p className="text-4xl font-mono font-bold text-primary">
                  {product.current_stock.toLocaleString('en-IN')} <span className="text-lg text-muted-foreground">{product.unit}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Pricing / Rates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Cash (Non-GST)</span>
                  <span className="font-mono font-medium">₹{Number(product.price_non_gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Billed (With GST)</span>
                  <span className="font-mono font-bold">₹{Number(product.price_gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stock Ledger */}
      <div className="mt-6 sm:mt-8">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
          <Icons.inventory className="w-5 h-5 text-primary" /> Stock Transaction Ledger
        </h3>

        {ledgerLoading ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 flex items-center justify-center">
              <Icons.refresh className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
            </CardContent>
          </Card>
        ) : ledger.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center">
              <Icons.search className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">No stock history</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Movements from Purchase Orders, Sales, and manual adjustments will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/60 border-b border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Ref ID / Doc #</th>
                    <th className="px-4 py-3">Counterparty</th>
                    <th className="px-4 py-3 text-right">In/Out Qty</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {ledger.map((entry) => {
                    const isIn = entry.type === 'In';
                    return (
                      <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {new Date(entry.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[10px] ${isIn ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>
                            {entry.display_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs">{entry.reference_number}</span>
                          {entry.reason && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{entry.reason}</p>}
                        </td>
                        <td className="px-4 py-3 font-medium text-muted-foreground text-xs">
                          {entry.counterparty}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${isIn ? 'text-success' : 'text-destructive'}`}>
                          {isIn ? '+' : '-'}{entry.quantity.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                          {entry.running_balance.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

    </PageContainer>
  );
}
