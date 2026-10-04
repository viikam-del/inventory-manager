'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

interface ProductOption {
  id: string;
  name: string;
  sku_code: string;
  unit: string;
  category: string;
  current_stock: number;
}

type AdjustmentMode = 'count' | 'delta';

interface AdjustmentLineItem {
  id: string;
  product_id: string;
  // Physical count mode
  counted_quantity: string;
  // Direct delta mode
  direction: 'In' | 'Out';
  delta_quantity: string;
  // Metadata
  reference_type: string;
  reason: string;
}

const COMMON_REASONS = {
  count: [
    'Physical Cycle Count Variance',
    'Monthly Shelf Reconciliation',
    'Annual Stocktake Audit',
    'Damaged / Lost Stock Identified',
    'Unrecorded Supplier Surplus Found',
  ],
  delta_out: [
    'Damage / Warehouse Breakage',
    'Expiry / Spoilage Write-off',
    'Internal Sample / Office Use',
    'Theft / Unexplained Loss',
    'Customer Replacement (Unbilled)',
    'Quality Defect Scrapped',
  ],
  delta_in: [
    'Surplus / Found During Rearrangement',
    'Customer Returned Without Invoice',
    'Supplier Sample Inbound',
    'Opening Balance Correction',
    'Stock Transfer Inward',
  ],
};

function NewStockAdjustmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProductId = searchParams.get('product_id');

  const [mode, setMode] = useState<AdjustmentMode>('count');
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');

  const [lines, setLines] = useState<AdjustmentLineItem[]>([
    {
      id: 'line-1',
      product_id: preselectedProductId || '',
      counted_quantity: '',
      direction: 'Out',
      delta_quantity: '',
      reference_type: 'Physical Count',
      reason: 'Physical Cycle Count Variance',
    },
  ]);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoadingProducts(true);
    try {
      const { data, error: prodErr } = await supabase
        .from('products')
        .select('id, name, sku_code, unit, category, current_stock')
        .eq('is_deleted', false)
        .order('name', { ascending: true });

      if (prodErr) throw prodErr;
      const list = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku_code: p.sku_code,
        unit: p.unit || 'Units',
        category: p.category || 'General',
        current_stock: Number(p.current_stock) || 0,
      }));
      setProducts(list);

      // If preselected in URL, populate its current stock into counted_quantity as default
      if (preselectedProductId) {
        const found = list.find((p) => p.id === preselectedProductId);
        if (found) {
          setLines([
            {
              id: 'line-1',
              product_id: found.id,
              counted_quantity: String(found.current_stock),
              direction: 'Out',
              delta_quantity: '',
              reference_type: 'Physical Count',
              reason: 'Physical Cycle Count Variance',
            },
          ]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load products', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  }

  const handleProductChange = (index: number, productId: string) => {
    const selectedProd = products.find((p) => p.id === productId);
    const updated = [...lines];
    updated[index].product_id = productId;

    if (selectedProd && mode === 'count' && !updated[index].counted_quantity) {
      // Pre-fill counted quantity with current stock so user can easily bump it up or down
      updated[index].counted_quantity = String(selectedProd.current_stock);
    }

    setLines(updated);
  };

  const handleLineChange = (
    index: number,
    field: keyof AdjustmentLineItem,
    value: string
  ) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-align default reason and reference type when direction changes in delta mode
    if (field === 'direction') {
      if (value === 'In') {
        updated[index].reference_type = 'Surplus / Found';
        updated[index].reason = 'Surplus / Found During Rearrangement';
      } else {
        updated[index].reference_type = 'Damage Write-off';
        updated[index].reason = 'Damage / Warehouse Breakage';
      }
    }

    setLines(updated);
  };

  const addLine = () => {
    const nextId = `line-${Date.now()}`;
    setLines([
      ...lines,
      {
        id: nextId,
        product_id: '',
        counted_quantity: '',
        direction: 'Out',
        delta_quantity: '',
        reference_type: mode === 'count' ? 'Physical Count' : 'Damage Write-off',
        reason:
          mode === 'count'
            ? 'Physical Cycle Count Variance'
            : 'Damage / Warehouse Breakage',
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const switchMode = (newMode: AdjustmentMode) => {
    setMode(newMode);
    // Adjust line defaults for the chosen mode
    setLines(
      lines.map((l) => {
        const prod = products.find((p) => p.id === l.product_id);
        return {
          ...l,
          counted_quantity:
            newMode === 'count' && prod ? String(prod.current_stock) : l.counted_quantity,
          reference_type:
            newMode === 'count'
              ? 'Physical Count'
              : l.direction === 'In'
              ? 'Surplus / Found'
              : 'Damage Write-off',
          reason:
            newMode === 'count'
              ? 'Physical Cycle Count Variance'
              : l.direction === 'In'
              ? 'Surplus / Found During Rearrangement'
              : 'Damage / Warehouse Breakage',
        };
      })
    );
  };

  // Calculations for summary rail
  const lineCalculations = lines.map((line) => {
    const product = products.find((p) => p.id === line.product_id);
    const currentStock = product ? product.current_stock : 0;

    if (mode === 'count') {
      const counted = line.counted_quantity !== '' ? Number(line.counted_quantity) : null;
      if (counted === null || isNaN(counted) || !product) {
        return {
          product,
          currentStock,
          newStock: currentStock,
          variance: 0,
          adjustmentType: null as 'In' | 'Out' | null,
          adjustedQty: 0,
          hasChange: false,
        };
      }
      const variance = counted - currentStock;
      const hasChange = variance !== 0;
      const adjustmentType: 'In' | 'Out' | null =
        variance > 0 ? 'In' : variance < 0 ? 'Out' : null;
      const adjustedQty = Math.abs(variance);
      return {
        product,
        currentStock,
        newStock: counted,
        variance,
        adjustmentType,
        adjustedQty,
        hasChange,
      };
    } else {
      // Delta mode
      const qty = Number(line.delta_quantity) || 0;
      const hasChange = qty > 0 && !!product;
      const adjustmentType: 'In' | 'Out' = line.direction;
      const newStock =
        line.direction === 'In'
          ? currentStock + qty
          : Math.max(0, currentStock - qty);
      const variance = line.direction === 'In' ? qty : -qty;
      return {
        product,
        currentStock,
        newStock,
        variance,
        adjustmentType,
        adjustedQty: qty,
        hasChange,
      };
    }
  });

  const totalInflow = lineCalculations
    .filter((c) => c.hasChange && c.adjustmentType === 'In')
    .reduce((sum, c) => sum + c.adjustedQty, 0);

  const totalOutflow = lineCalculations
    .filter((c) => c.hasChange && c.adjustmentType === 'Out')
    .reduce((sum, c) => sum + c.adjustedQty, 0);

  const validActionableLinesCount = lineCalculations.filter(
    (c) => c.hasChange && c.adjustedQty > 0
  ).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    const unselectedLine = lines.findIndex((l) => !l.product_id);
    if (unselectedLine !== -1) {
      setError(`Please select a product on line item #${unselectedLine + 1}`);
      return;
    }

    if (validActionableLinesCount === 0) {
      if (mode === 'count') {
        setError(
          'No stock variance detected across the lines. Counted shelf quantities match system records exactly. No adjustment is required.'
        );
      } else {
        setError('Please enter a positive adjustment quantity greater than 0.');
      }
      return;
    }

    setSubmitting(true);
    try {
      // Process each line that has an actual change
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const calc = lineCalculations[i];

        if (!calc.hasChange || calc.adjustedQty <= 0 || !calc.adjustmentType) {
          continue; // Skip zero-variance lines
        }

        const reasonNote = line.reason.trim()
          ? generalNotes.trim()
            ? `${line.reason.trim()} (${generalNotes.trim()})`
            : line.reason.trim()
          : generalNotes.trim() ||
            (mode === 'count'
              ? 'Physical Shelf Count Reconciliation'
              : 'Manual Stock Adjustment');

        // 1. Insert into stock_adjustments ledger
        const { error: adjErr } = await supabase.from('stock_adjustments').insert({
          product_id: line.product_id,
          adjustment_type: calc.adjustmentType,
          quantity: calc.adjustedQty,
          reason: reasonNote,
          reference_type: line.reference_type || (mode === 'count' ? 'Physical Count' : 'Manual'),
          reference_id: null,
        });

        if (adjErr) throw adjErr;

        // 2. Synchronously update current_stock in products table
        const { error: prodUpdateErr } = await supabase
          .from('products')
          .update({ current_stock: calc.newStock })
          .eq('id', line.product_id);

        if (prodUpdateErr) throw prodUpdateErr;
      }

      // Success redirect
      if (preselectedProductId) {
        router.push(`/products/${preselectedProductId}`);
      } else {
        router.push('/stock-adjustments');
      }
    } catch (err: any) {
      console.error('Failed to commit stock adjustments', err);
      setError(err.message || 'Failed to commit stock adjustments');
      setSubmitting(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Record Stock Adjustment"
        description="Reconcile physical warehouse shelf stock, cycle counts, damage write-offs, and master ledger movements"
        backHref="/stock-adjustments"
        backLabel="Back to Stock Ledger"
      />

      {error && (
        <Card className="border-destructive/30 bg-destructive/5 mb-6">
          <CardContent className="p-4 flex items-center gap-3 text-destructive text-sm">
            <Icons.warning className="w-5 h-5 shrink-0" />
            <p className="font-medium">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Operational Mode Toggle Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          type="button"
          onClick={() => switchMode('count')}
          className={`p-4 rounded-xl border text-left transition-all relative ${
            mode === 'count'
              ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
              : 'border-border/70 bg-card hover:bg-muted/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                mode === 'count'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Icons.scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Physical Shelf Count Audit
                </h4>
                {mode === 'count' && (
                  <Badge variant="default" className="text-[10px] py-0 px-1.5">
                    Active Mode
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Input actual counted stock on shelf. System computes variance (+ surplus / - loss) automatically.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => switchMode('delta')}
          className={`p-4 rounded-xl border text-left transition-all relative ${
            mode === 'delta'
              ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
              : 'border-border/70 bg-card hover:bg-muted/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                mode === 'delta'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Icons.stockAdjustments className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Quick Delta Adjustment (+ / -)
                </h4>
                {mode === 'delta' && (
                  <Badge variant="default" className="text-[10px] py-0 px-1.5">
                    Active Mode
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Directly add or deduct quantities for damaged goods, breakage, internal samples, or manual fixes.
              </p>
            </div>
          </div>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Left / Middle Area: Adjustment Lines */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-xs border-border/70 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/20 border-b">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {mode === 'count'
                      ? 'Warehouse Count Line Items'
                      : 'Adjustment Delta Line Items'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {mode === 'count'
                      ? 'Compare actual physical counted shelf inventory against recorded book stock.'
                      : 'Specify products and units to add or write off.'}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                  className="gap-1.5 h-8 text-xs"
                >
                  <Icons.add className="w-3.5 h-3.5" />
                  Add Product Line
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 border-b text-xs text-muted-foreground font-medium">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Product & Current Book Stock</th>
                        {mode === 'count' ? (
                          <>
                            <th className="py-2.5 px-3 w-32 text-right">Physical Count</th>
                            <th className="py-2.5 px-3 w-28 text-center">Variance</th>
                          </>
                        ) : (
                          <>
                            <th className="py-2.5 px-3 w-28 text-center">Direction</th>
                            <th className="py-2.5 px-3 w-28 text-right">Qty</th>
                            <th className="py-2.5 px-3 w-28 text-center">New Stock</th>
                          </>
                        )}
                        <th className="py-2.5 px-3 min-w-[160px]">Reason / Reference</th>
                        <th className="py-2.5 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-xs">
                      {lines.map((line, index) => {
                        const product = products.find((p) => p.id === line.product_id);
                        const calc = lineCalculations[index];
                        const unit = product?.unit || 'Units';

                        return (
                          <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                            {/* Line Number */}
                            <td className="py-3 px-3 text-center font-mono text-muted-foreground">
                              {index + 1}
                            </td>

                            {/* Product Selector */}
                            <td className="py-3 px-3">
                              <select
                                value={line.product_id}
                                onChange={(e) => handleProductChange(index, e.target.value)}
                                required
                                aria-label="Select Product"
                                className="w-full px-2.5 py-1.5 text-xs bg-background border rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary font-medium"
                              >
                                <option value="">-- Choose Product --</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.sku_code ? `${p.sku_code} | ` : ''}Stock: {p.current_stock} {p.unit})
                                  </option>
                                ))}
                              </select>
                              {product && (
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                                  <span>System Book Stock:</span>
                                  <span className="font-semibold text-foreground">
                                    {product.current_stock.toLocaleString('en-IN')} {unit}
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Mode A: Physical Count inputs */}
                            {mode === 'count' ? (
                              <>
                                <td className="py-3 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      placeholder="0"
                                      value={line.counted_quantity}
                                      onChange={(e) =>
                                        handleLineChange(index, 'counted_quantity', e.target.value)
                                      }
                                      required
                                      aria-label="Physical Count Quantity"
                                      className="w-24 px-2 py-1.5 text-xs text-right font-mono bg-background border rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary"
                                    />
                                    <span className="text-[11px] text-muted-foreground">{unit}</span>
                                  </div>
                                </td>

                                <td className="py-3 px-3 text-center whitespace-nowrap">
                                  {calc.hasChange ? (
                                    <Badge
                                      variant={calc.variance > 0 ? 'success' : 'destructive'}
                                      className="font-mono text-[10px] px-1.5 py-0.5"
                                    >
                                      {calc.variance > 0 ? `+${calc.variance}` : calc.variance} {unit}
                                    </Badge>
                                  ) : line.counted_quantity !== '' && product ? (
                                    <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                                      0 (Matched)
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground font-mono text-xs">—</span>
                                  )}
                                </td>
                              </>
                            ) : (
                              /* Mode B: Direct Delta inputs */
                              <>
                                <td className="py-3 px-3 text-center">
                                  <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-[11px]">
                                    <button
                                      type="button"
                                      onClick={() => handleLineChange(index, 'direction', 'In')}
                                      className={`px-2 py-0.5 rounded font-medium transition-all ${
                                        line.direction === 'In'
                                          ? 'bg-emerald-500 text-white font-semibold'
                                          : 'text-muted-foreground hover:text-foreground'
                                      }`}
                                    >
                                      + IN
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleLineChange(index, 'direction', 'Out')}
                                      className={`px-2 py-0.5 rounded font-medium transition-all ${
                                        line.direction === 'Out'
                                          ? 'bg-rose-500 text-white font-semibold'
                                          : 'text-muted-foreground hover:text-foreground'
                                      }`}
                                    >
                                      - OUT
                                    </button>
                                  </div>
                                </td>

                                <td className="py-3 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="any"
                                      placeholder="0"
                                      value={line.delta_quantity}
                                      onChange={(e) =>
                                        handleLineChange(index, 'delta_quantity', e.target.value)
                                      }
                                      required
                                      aria-label="Adjustment Quantity"
                                      className="w-20 px-2 py-1.5 text-xs text-right font-mono bg-background border rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary"
                                    />
                                    <span className="text-[11px] text-muted-foreground">{unit}</span>
                                  </div>
                                </td>

                                <td className="py-3 px-3 text-center font-mono font-semibold text-foreground text-xs whitespace-nowrap">
                                  {calc.hasChange ? (
                                    <span className="text-primary bg-primary/5 px-2 py-1 rounded border border-primary/10">
                                      {calc.newStock.toLocaleString('en-IN')}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              </>
                            )}

                            {/* Reason & Reference Type */}
                            <td className="py-3 px-3 space-y-1.5">
                              <select
                                value={line.reference_type}
                                onChange={(e) =>
                                  handleLineChange(index, 'reference_type', e.target.value)
                                }
                                aria-label="Reference / Operation Category"
                                className="w-full px-2 py-1 text-[11px] bg-background border rounded focus:outline-hidden focus:ring-1 focus:ring-primary text-muted-foreground"
                              >
                                {mode === 'count' ? (
                                  <>
                                    <option value="Physical Count">Physical Shelf Count</option>
                                    <option value="Cycle Count">Cycle Count</option>
                                    <option value="Manual">Manual Audit</option>
                                  </>
                                ) : line.direction === 'Out' ? (
                                  <>
                                    <option value="Damage Write-off">Damage Write-off</option>
                                    <option value="Internal Consumption">Internal Consumption / Sample</option>
                                    <option value="Manual">Manual Outflow</option>
                                    <option value="Cycle Count">Cycle Count Shortage</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="Surplus / Found">Surplus / Found Inventory</option>
                                    <option value="Manual">Manual Inflow</option>
                                    <option value="Cycle Count">Cycle Count Surplus</option>
                                  </>
                                )}
                              </select>

                              <input
                                type="text"
                                list={`reasons-list-${index}`}
                                placeholder="Audit reason / note..."
                                value={line.reason}
                                onChange={(e) => handleLineChange(index, 'reason', e.target.value)}
                                className="w-full px-2 py-1 text-[11px] bg-background border rounded focus:outline-hidden focus:ring-1 focus:ring-primary"
                              />
                              <datalist id={`reasons-list-${index}`}>
                                {(mode === 'count'
                                  ? COMMON_REASONS.count
                                  : line.direction === 'Out'
                                  ? COMMON_REASONS.delta_out
                                  : COMMON_REASONS.delta_in
                                ).map((r) => (
                                  <option key={r} value={r} />
                                ))}
                              </datalist>
                            </td>

                            {/* Remove Line */}
                            <td className="py-3 px-2 text-center">
                              {lines.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeLine(index)}
                                  className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                                  title="Remove Line"
                                >
                                  <Icons.trash className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* General Audit Remarks */}
            <Card className="shadow-xs border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Batch Audit Documentation & Notes
                </CardTitle>
                <CardDescription className="text-xs">
                  Attach warehouse bin / rack location notes, auditor initials, or reason code for cross-referencing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  rows={2}
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="e.g. Audit conducted on Rack B4 by Inspector John, physical counts verified against warehouse clipboards..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-background border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Rail: Real-time Variance Summary & Submit Card */}
          <div className="space-y-6">
            <Card className="shadow-xs border-border/70 sticky top-20">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Icons.stockAdjustments className="w-4 h-4 text-primary" />
                  Adjustment Summary
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time inventory ledger preview
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Operational Mode:</span>
                  <Badge variant="outline" className="font-medium text-[11px]">
                    {mode === 'count' ? 'Shelf Count Audit' : 'Delta Adjustment'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Product Lines in Form:</span>
                  <span className="font-mono font-medium">{lines.length} items</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Actionable Adjustments:</span>
                  <span className="font-mono font-bold text-foreground">
                    {validActionableLinesCount} items
                  </span>
                </div>

                <div className="pt-3 border-t space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Icons.in className="w-3.5 h-3.5" /> Total Stock Inflow:
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{totalInflow.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                      <Icons.out className="w-3.5 h-3.5" /> Total Stock Outflow:
                    </span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      -{totalOutflow.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="pt-2 border-t flex justify-between items-center text-sm font-bold">
                    <span>Net Inventory Flow:</span>
                    <span
                      className={`font-mono ${
                        totalInflow - totalOutflow >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {totalInflow - totalOutflow >= 0 ? '+' : ''}
                      {(totalInflow - totalOutflow).toLocaleString('en-IN')} Units
                    </span>
                  </div>
                </div>

                {validActionableLinesCount === 0 && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-2">
                    <Icons.info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {mode === 'count'
                        ? 'Counted quantities match book stock. Change a count to record a discrepancy.'
                        : 'Enter quantities greater than 0 to apply stock adjustments.'}
                    </span>
                  </div>
                )}

                <div className="pt-2 space-y-2">
                  <Button
                    type="submit"
                    disabled={submitting || validActionableLinesCount === 0}
                    className="w-full gap-2 shadow-xs h-10 text-sm font-semibold"
                  >
                    {submitting ? (
                      <>
                        <Icons.refresh className="w-4 h-4 animate-spin" />
                        Committing Adjustments...
                      </>
                    ) : (
                      <>
                        <Icons.check className="w-4 h-4" />
                        Apply & Update Stock
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    asChild
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Link href="/stock-adjustments">Cancel & Return</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Audit Compliance Notice */}
            <div className="p-4 rounded-xl border border-border/70 bg-card/60 text-xs text-muted-foreground space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Icons.scale className="w-4 h-4 text-primary" />
                <span>Audit Trail Guarantee</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Every transaction committed here permanently updates the master ledger in <code>stock_adjustments</code> and syncs the product catalog running stock with full attribution.
              </p>
            </div>
          </div>
        </div>
      </form>
    </PageContainer>
  );
}

export default function NewStockAdjustmentPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <div className="py-24 text-center">
            <Icons.refresh className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
            <p className="text-muted-foreground text-sm">Preparing stock adjustment engine...</p>
          </div>
        </PageContainer>
      }
    >
      <NewStockAdjustmentForm />
    </Suspense>
  );
}
