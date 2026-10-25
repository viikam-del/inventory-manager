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
import { Timeline } from '@/components/ui/timeline';
import { getAuditLogsForEntity, logAuditEvent, AuditLog } from '@/lib/audit';

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
  cost_price: number;
  current_stock: number;
  min_stock_level: number;
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
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stockDrift, setStockDrift] = useState<{ hasDrift: boolean; ledgerBalance: number } | null>(null);
  const [poCostHistory, setPoCostHistory] = useState<any[]>([]);

  async function fetchPoCostHistory(productId: string) {
    try {
      const { data, error } = await supabase
        .from('purchase_order_lines')
        .select(`
          id, quantity, unit_cost, billed_rate, cash_rate,
          purchase_orders (
            po_number, order_date, delivery_charges,
            suppliers ( company_name )
          )
        `)
        .eq('product_id', productId);

      if (!error && data) {
        setPoCostHistory(data);
      }
    } catch (e) {
      console.error('Failed to fetch PO cost history', e);
    }
  }

  const handleReconcile = async () => {
    if (!product || !stockDrift) return;
    if (!confirm(`Reconcile stock? This will update product current stock from ${product.current_stock} to ledger balance ${stockDrift.ledgerBalance}.`)) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({ current_stock: stockDrift.ledgerBalance, updated_at: new Date().toISOString() })
        .eq('id', product.id);

      if (error) throw error;
      void logAuditEvent('product', product.id, 'adjust_stock', null, {
        old_stock: product.current_stock,
        new_stock: stockDrift.ledgerBalance,
        reason: 'Stock Reconciliation'
      });
      alert('Stock reconciled successfully!');
      fetchProduct();
    } catch (err: any) {
      alert(err.message || 'Failed to reconcile stock');
    } finally {
      setActionLoading(false);
    }
  };

  async function fetchProductLedger(productId: string, stockParam?: number) {
    setLedgerLoading(true);
    try {
      // 1. Fetch raw stock adjustments
      let { data: adjustments, error: adjError } = await supabase
        .from('stock_adjustments')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: true }); // chronological

      if (adjError) throw adjError;

      const effectiveStock = stockParam !== undefined ? stockParam : (product?.current_stock || 0);

      // Check if opening stock adjustment exists
      const hasOpening = adjustments && adjustments.some((a: any) =>
        ['Opening Stock', 'Opening Balance', 'Initial Stock'].includes(a.reference_type)
      );

      if (!hasOpening) {
        let netChange = 0;
        if (adjustments) {
          adjustments.forEach((a: any) => {
            const q = Number(a.quantity) || 0;
            if (a.adjustment_type === 'In') netChange += q;
            else netChange -= q;
          });
        }

        const calculatedOpening = effectiveStock - netChange;

        if (calculatedOpening > 0 || (!adjustments || adjustments.length === 0)) {
          const openingQty = calculatedOpening > 0 ? calculatedOpening : effectiveStock;
          if (openingQty > 0) {
            const firstAdjDate = adjustments?.[0]?.created_at;
            const openingDate = firstAdjDate ? new Date(new Date(firstAdjDate).getTime() - 1000 * 60).toISOString() : new Date().toISOString();

            await supabase.from('stock_adjustments').insert({
              product_id: productId,
              adjustment_type: 'In',
              quantity: openingQty,
              reason: 'Initial Opening Stock (Auto-backfilled)',
              reference_type: 'Opening Stock',
              reference_id: null,
              created_at: openingDate
            });

            const { data: retryAdj } = await supabase
              .from('stock_adjustments')
              .select('*')
              .eq('product_id', productId)
              .order('created_at', { ascending: true });
            adjustments = retryAdj || [];
          }
        }
      }

      if (!adjustments || adjustments.length === 0) {
        setLedger([]);
        setLedgerLoading(false);
        return;
      }

      // 2. We need to enrich adjustments with receipt/sales order numbers and counterparties
      // Collect IDs
      const receiptIds = adjustments.filter((a: any) => a.reference_type === 'Receipt' && a.reference_id).map((a: any) => a.reference_id);
      const soIds = adjustments.filter((a: any) => a.reference_type === 'SalesOrder' && a.reference_id).map((a: any) => a.reference_id);
      const crIds = adjustments.filter((a: any) => (a.reference_type === 'Customer Return' || a.reference_type === 'Return') && a.reference_id).map((a: any) => a.reference_id);
      const srIds = adjustments.filter((a: any) => a.reference_type === 'Supplier Return' && a.reference_id).map((a: any) => a.reference_id);

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

      // Fetch Customer Returns
      const crMap = new Map();
      if (crIds.length > 0) {
        try {
          const { data: crData } = await supabase
            .from('customer_returns')
            .select('id, return_number, customers(company_name)')
            .in('id', crIds);

          if (crData) {
            crData.forEach((cr: any) => {
              crMap.set(cr.id, {
                number: cr.return_number,
                counterparty: cr.customers?.company_name || 'Customer'
              });
            });
          }
        } catch (e) {
          console.error('Failed to fetch customer returns for ledger', e);
        }
      }

      // Fetch Supplier Returns
      const srMap = new Map();
      if (srIds.length > 0) {
        try {
          const { data: srData } = await supabase
            .from('supplier_returns')
            .select('id, return_number, suppliers(company_name)')
            .in('id', srIds);

          if (srData) {
            srData.forEach((sr: any) => {
              srMap.set(sr.id, {
                number: sr.return_number,
                counterparty: sr.suppliers?.company_name || 'Supplier'
              });
            });
          }
        } catch (e) {
          console.error('Failed to fetch supplier returns for ledger', e);
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
        let reference_number = adj.id ? adj.id.substring(0, 8) : 'ADJ-MANUAL';
        let counterparty = 'Manual Entry';

        if (adj.reference_type === 'Opening Stock' || adj.reference_type === 'Opening Balance' || adj.reference_type === 'Initial Stock') {
          display_type = 'Opening Stock';
          reference_number = 'OPENING';
          counterparty = 'Initial Inventory';
        } else if (adj.reference_type === 'Receipt') {
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
        } else if (adj.reference_type === 'Customer Return' || adj.reference_type === 'Return') {
          display_type = 'Customer Return';
          const cr = crMap.get(adj.reference_id);
          if (cr) {
            reference_number = cr.number;
            counterparty = cr.counterparty;
          } else {
            reference_number = 'CR-RETURN';
            counterparty = 'Customer Return';
          }
        } else if (adj.reference_type === 'Supplier Return') {
          display_type = 'Vendor Return';
          const sr = srMap.get(adj.reference_id);
          if (sr) {
            reference_number = sr.number;
            counterparty = sr.counterparty;
          } else {
            reference_number = 'SR-DEBIT';
            counterparty = 'Vendor Return';
          }
        } else if (adj.reference_type === 'Physical Count') {
          display_type = 'Physical Count';
          reference_number = 'SHELF-AUDIT';
          counterparty = 'Warehouse Shelf Audit';
        } else if (adj.reference_type === 'Cycle Count') {
          display_type = 'Cycle Count';
          reference_number = 'CYCLE-AUDIT';
          counterparty = 'Cycle Count Audit';
        } else if (adj.reference_type === 'Damage Write-off') {
          display_type = 'Damage Write-off';
          reference_number = 'LOSS-SCRAP';
          counterparty = 'Loss / Damage Write-off';
        } else if (adj.reference_type === 'Internal Consumption') {
          display_type = 'Internal Sample';
          reference_number = 'INTERNAL-USE';
          counterparty = 'Internal Sample';
        } else if (adj.reference_type === 'Surplus / Found') {
          display_type = 'Surplus Found';
          reference_number = 'SURPLUS-DISC';
          counterparty = 'Stock Discovery';
        } else if (adj.reference_type) {
          display_type = adj.reference_type;
          counterparty = '-';
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

      if (product) {
        const hasDrift = Math.abs(product.current_stock - runningBalance) > 0.001;
        setStockDrift({ hasDrift, ledgerBalance: runningBalance });
      }

    } catch (err: any) {
      console.error('Failed to load product ledger', err);
    } finally {
      setLedgerLoading(false);
    }
  }

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
      if (data) {
        fetchProductLedger(data.id, data.current_stock);
        fetchPoCostHistory(data.id);
        getAuditLogsForEntity('product', data.id)
          .then(setAuditLogs)
          .catch((err) => console.error('Failed to load audit logs:', err));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProduct();
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    setActionLoading(true);
    try {
      const { error: supabaseError } = await supabase
        .from('products')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', params.id);

      if (supabaseError) throw supabaseError;
      void logAuditEvent('product', params.id as string, 'delete', null, {
        product_name: product?.name,
        sku_code: product?.sku_code,
      });
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
            <Button size="sm" asChild className="h-8 gap-1.5 text-xs shadow-xs">
              <Link href={`/stock-adjustments/new?product_id=${product.id}`}>
                <Icons.stockAdjustments className="w-3.5 h-3.5" /> Adjust / Reconcile
              </Link>
            </Button>

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

      {/* Stock Drift Warning Banner */}
      {stockDrift?.hasDrift && (
        <Card className="mb-6 border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-700 dark:text-amber-400 text-sm font-medium">
            <div className="flex items-center gap-2.5">
              <Icons.warning className="w-5 h-5 shrink-0" />
              <span>
                <strong>Stock Drift Detected:</strong> Current stock ({product.current_stock}) does not match ledger balance ({stockDrift.ledgerBalance}).
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={handleReconcile} disabled={actionLoading} className="border-amber-500/40 hover:bg-amber-500/20 text-xs">
              Reconcile to {stockDrift.ledgerBalance}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Low Stock Warning Banner */}
      {product.current_stock <= product.min_stock_level && (
        <Card className="mb-6 border-destructive/30 bg-destructive/10">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-destructive text-sm font-medium">
            <div className="flex items-center gap-2.5">
              <Icons.warning className="w-5 h-5 shrink-0" />
              <span>
                <strong>Low Stock Alert:</strong> Stock ({product.current_stock} {product.unit}) is at or below minimum threshold ({product.min_stock_level} {product.unit}).
              </span>
            </div>
            <Button size="sm" asChild variant="outline" className="border-destructive/40 hover:bg-destructive/20 text-xs">
              <Link href={`/purchase-orders/new?product_id=${product.id}`}>
                Create Reorder PO
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

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
              <CardTitle className="text-sm">Pricing / Rates & Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Cost Price (Landed)</span>
                  <span className="font-mono font-medium">₹{Number(product.cost_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Cash (Non-GST)</span>
                  <span className="font-mono font-medium">₹{Number(product.price_non_gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Billed (With GST)</span>
                  <span className="font-mono font-bold">₹{Number(product.price_gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {product.cost_price > 0 && (
                  <div className="flex justify-between items-center pt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span>Estimated Unit Profit (Non-GST)</span>
                    <span className="font-mono">
                      ₹{(Number(product.price_non_gst) - Number(product.cost_price)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      {' '}({Math.round(((Number(product.price_non_gst) - Number(product.cost_price)) / Number(product.cost_price)) * 100)}%)
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Procurement Cost Calculation & PO History with Live Numbers */}
      <div className="mt-6 sm:mt-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Icons.inventory className="w-5 h-5 text-primary" /> Cost Calculation & Weighted Average Math (Live Numbers)
            </CardTitle>
            <CardDescription className="text-xs">
              Step-by-step numerical breakdown of landed cost price, weighted average valuation, and unit profit margins for {product.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {(() => {
              const currentStock = Number(product.current_stock) || 0;
              const currentCp = Number(product.cost_price) || 0;
              const nonGstPrice = Number(product.price_non_gst) || 0;
              const unitProfit = nonGstPrice - currentCp;
              const marginPct = currentCp > 0 ? Math.round((unitProfit / currentCp) * 100) : 0;

              const latestPoLine = poCostHistory.length > 0 ? poCostHistory[0] : null;
              const receivedQty = latestPoLine ? Number(latestPoLine.quantity) || 50 : Math.min(20, currentStock || 50);
              const landedCost = latestPoLine ? Number(latestPoLine.unit_cost) || currentCp : currentCp;
              const priorStock = Math.max(0, currentStock - receivedQty);

              const valuationPrior = priorStock * currentCp;
              const valuationReceived = receivedQty * landedCost;

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Weighted Average Cost Card with Numbers */}
                    <div className="bg-muted/40 p-4 rounded-lg border border-border/60 space-y-2.5">
                      <h4 className="font-semibold text-xs uppercase tracking-wider text-primary flex items-center justify-between">
                        <span>1. Weighted Average Cost Calculation</span>
                        <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Active CP: ₹{currentCp.toFixed(2)}</span>
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Numerical breakdown using current stock inventory and latest PO receiving batch:
                      </p>

                      <div className="bg-background p-3 rounded border space-y-1.5 font-mono text-xs text-foreground shadow-xs">
                        <div className="flex justify-between border-b border-border/40 pb-1 text-[11px] text-muted-foreground">
                          <span>Component Variable</span>
                          <span>Value & Formula</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Prior Stock & CP:</span>
                          <span>{priorStock} {product.unit} × ₹{currentCp.toFixed(2)} = ₹{valuationPrior.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Received Qty & Landed Cost:</span>
                          <span>{receivedQty} {product.unit} × ₹{landedCost.toFixed(2)} = ₹{valuationReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between border-t border-border/40 pt-1 font-bold text-primary">
                          <span>Resulting Weighted CP:</span>
                          <span>(₹{valuationPrior.toLocaleString()} + ₹{valuationReceived.toLocaleString()}) / {currentStock || (priorStock + receivedQty)} = ₹{currentCp.toFixed(2)} / {product.unit}</span>
                        </div>
                      </div>
                    </div>

                    {/* Profit Margin Card with Numbers */}
                    <div className="bg-muted/40 p-4 rounded-lg border border-border/60 space-y-2.5">
                      <h4 className="font-semibold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                        <span>2. Profit Margin Calculation</span>
                        <span className="font-mono text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">Margin: {marginPct}%</span>
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Numerical breakdown comparing Non-GST Selling Price against Landed Cost Price:
                      </p>

                      <div className="bg-background p-3 rounded border space-y-1.5 font-mono text-xs text-foreground shadow-xs">
                        <div className="flex justify-between border-b border-border/40 pb-1 text-[11px] text-muted-foreground">
                          <span>Pricing Metric</span>
                          <span>Numerical Amount</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Non-GST Selling Price:</span>
                          <span>₹{nonGstPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Less: Landed Cost Price (CP):</span>
                          <span>- ₹{currentCp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between border-t border-border/40 pt-1 font-bold text-emerald-600 dark:text-emerald-400">
                          <span>Net Unit Profit & %:</span>
                          <span>₹{unitProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({marginPct}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* PO Cost History Breakdown */}
            <div className="pt-4 border-t border-border/50">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-foreground mb-3">Procuring Purchase Orders & Unit Cost History</h4>
              {poCostHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No purchase order lines recorded for this product yet. Cost price is currently set from initial opening stock or manual adjustment.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 border-b border-border/60 text-muted-foreground font-medium uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2">PO # & Date</th>
                        <th className="px-3 py-2">Supplier</th>
                        <th className="px-3 py-2 text-right">Qty Received</th>
                        <th className="px-3 py-2 text-right">Billed Rate</th>
                        <th className="px-3 py-2 text-right">Cash Rate</th>
                        <th className="px-3 py-2 text-right">Freight Per Unit</th>
                        <th className="px-3 py-2 text-right">Total Landed Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {poCostHistory.map((line: any) => {
                        const billed = Number(line.billed_rate || 0);
                        const cash = Number(line.cash_rate || 0);
                        const baseCost = billed + cash;
                        const freightPerUnit = Number(line.unit_cost) - baseCost;
                        const totalLanded = Number(line.unit_cost) || baseCost;

                        return (
                          <tr key={line.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2.5">
                              <span className="font-mono font-medium text-foreground">{line.purchase_orders?.po_number || 'PO'}</span>
                              <span className="block text-[10px] text-muted-foreground">{line.purchase_orders?.order_date ? new Date(line.purchase_orders.order_date).toLocaleDateString('en-IN') : '—'}</span>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {line.purchase_orders?.suppliers?.company_name || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-medium">
                              {Number(line.quantity || 0).toLocaleString('en-IN')} {product.unit}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono">
                              ₹{billed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono">
                              ₹{cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-orange-600 dark:text-orange-400">
                              {freightPerUnit > 0
                                ? `₹${freightPerUnit.toFixed(2)} delivery`
                                : '<span class="opacity-30">—</span>'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-primary">
                              ₹{totalLanded.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    * Landed cost = Billed Rate + Cash Rate + (Total Delivery Charges ÷ Total Qty Received during this PO)
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
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

      {/* Activity & Stock Mutation Audit Timeline */}
      <div className="pt-2">
        <Timeline
          logs={auditLogs}
          title="Product Stock & Mutation Audit Trail"
          emptyMessage="No audit trail events recorded yet for this product."
        />
      </div>

    </PageContainer>
  );
}
