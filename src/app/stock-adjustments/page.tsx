'use client';

import { useEffect, useState, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

interface StockAdjustment {
  id: string;
  product_id: string;
  adjustment_type: 'In' | 'Out';
  quantity: number;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  products?: {
    id: string;
    name: string;
    sku_code: string;
    unit: string;
    category?: string;
    current_stock: number;
  } | null;
}

export default function StockAdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [typeFilter, setTypeFilter] = useState<'All' | 'In' | 'Out'>('All');
  const [refFilter, setRefFilter] = useState<string>('All');

  useEffect(() => {
    fetchAdjustments();
  }, []);

  async function fetchAdjustments() {
    setLoading(true);
    setError('');
    try {
      const { data, error: supabaseError } = await supabase
        .from('stock_adjustments')
        .select(`
          id,
          product_id,
          adjustment_type,
          quantity,
          reason,
          reference_type,
          reference_id,
          created_at,
          products (
            id,
            name,
            sku_code,
            unit,
            category,
            current_stock
          )
        `)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (supabaseError) throw supabaseError;

      const formatted: StockAdjustment[] = (data || []).map((row: any) => ({
        id: row.id,
        product_id: row.product_id,
        adjustment_type: row.adjustment_type,
        quantity: Number(row.quantity) || 0,
        reason: row.reason,
        reference_type: row.reference_type,
        reference_id: row.reference_id,
        created_at: row.created_at,
        products: row.products || null,
      }));

      setAdjustments(formatted);
    } catch (err: any) {
      console.error('Failed to load stock adjustments', err);
      setError(err.message || 'Failed to load stock adjustments');
    } finally {
      setLoading(false);
    }
  }

  // Filtered dataset
  const filteredAdjustments = adjustments.filter((adj) => {
    // Search
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase();
      const productName = adj.products?.name?.toLowerCase() || '';
      const sku = adj.products?.sku_code?.toLowerCase() || '';
      const reason = adj.reason?.toLowerCase() || '';
      const ref = adj.reference_type?.toLowerCase() || '';
      if (!productName.includes(q) && !sku.includes(q) && !reason.includes(q) && !ref.includes(q)) {
        return false;
      }
    }

    // Direction Type filter
    if (typeFilter !== 'All' && adj.adjustment_type !== typeFilter) {
      return false;
    }

    // Reference Type filter
    if (refFilter !== 'All') {
      if (refFilter === 'Returns') {
        if (adj.reference_type !== 'Customer Return' && adj.reference_type !== 'Supplier Return' && adj.reference_type !== 'Return') {
          return false;
        }
      } else if (adj.reference_type !== refFilter) {
        return false;
      }
    }

    return true;
  });

  // KPI calculations
  const totalCount = adjustments.length;
  const totalInUnits = adjustments
    .filter((a) => a.adjustment_type === 'In')
    .reduce((sum, a) => sum + a.quantity, 0);
  const totalOutUnits = adjustments
    .filter((a) => a.adjustment_type === 'Out')
    .reduce((sum, a) => sum + a.quantity, 0);
  const netVariance = totalInUnits - totalOutUnits;

  const distinctReferences = Array.from(
    new Set(adjustments.map((a) => a.reference_type).filter(Boolean))
  ) as string[];

  const getReferenceBadge = (refType: string | null) => {
    switch (refType) {
      case 'Physical Count':
        return <Badge variant="info" className="gap-1">Physical Count</Badge>;
      case 'Cycle Count':
        return <Badge variant="secondary" className="gap-1 font-mono">Cycle Count</Badge>;
      case 'Damage Write-off':
        return <Badge variant="destructive" className="gap-1">Damage / Loss</Badge>;
      case 'Internal Consumption':
        return <Badge variant="warning" className="gap-1">Internal Sample</Badge>;
      case 'Surplus / Found':
        return <Badge variant="success" className="gap-1">Surplus Found</Badge>;
      case 'Receipt':
        return <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/5">PO Inbound</Badge>;
      case 'SalesOrder':
        return <Badge variant="outline" className="border-blue-500/40 text-blue-600 bg-blue-500/5">SO Outbound</Badge>;
      case 'Customer Return':
        return <Badge variant="outline" className="border-purple-500/40 text-purple-600 bg-purple-500/5">Customer Return</Badge>;
      case 'Supplier Return':
        return <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/5">Vendor Outflow</Badge>;
      case 'Manual':
      default:
        return <Badge variant="outline">{refType || 'Manual'}</Badge>;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Stock Adjustments"
        description="Warehouse cycle counts, inventory reconciliation, loss write-offs, and master audit ledger"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAdjustments}
              disabled={loading}
              className="gap-1.5 h-9"
            >
              <Icons.refresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" asChild className="gap-1.5 h-9 shadow-xs">
              <Link href="/stock-adjustments/new">
                <Icons.stockAdjustments className="w-4 h-4" />
                <span>+ Reconcile / Adjust Stock</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Ledger Records"
          value={totalCount}
          icon={<Icons.document className="w-5 h-5 text-primary" />}
          description="All logged stock movements"
        />
        <StatCard
          title="Total Inflow Stock"
          value={`+${totalInUnits.toLocaleString('en-IN')}`}
          icon={<Icons.in className="w-5 h-5 text-emerald-500" />}
          iconClassName="bg-emerald-500/10 border-emerald-500/20"
          description="Receipts, surplus & customer returns"
        />
        <StatCard
          title="Total Outflow Stock"
          value={`-${totalOutUnits.toLocaleString('en-IN')}`}
          icon={<Icons.out className="w-5 h-5 text-rose-500" />}
          iconClassName="bg-rose-500/10 border-rose-500/20"
          description="Sales, damages & vendor returns"
        />
        <StatCard
          title="Net Stock Variance"
          value={`${netVariance >= 0 ? '+' : ''}${netVariance.toLocaleString('en-IN')}`}
          icon={<Icons.stockAdjustments className="w-5 h-5 text-blue-500" />}
          iconClassName="bg-blue-500/10 border-blue-500/20"
          description="Net cumulative inventory flow"
        />
      </div>

      {/* Filters Toolbar */}
      <Card className="mb-6">
        <CardContent className="p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search product, SKU, reason, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-muted/40 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Icons.close className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Direction Filter Pills */}
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
              {(['All', 'In', 'Out'] as const).map((direction) => (
                <button
                  key={direction}
                  onClick={() => setTypeFilter(direction)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    typeFilter === direction
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {direction === 'All'
                    ? 'All Moves'
                    : direction === 'In'
                    ? '+ Inflow'
                    : '- Outflow'}
                </button>
              ))}
            </div>

            {/* Reference Filter Dropdown */}
            <select
              value={refFilter}
              onChange={(e) => setRefFilter(e.target.value)}
              aria-label="Filter by Reference Type"
              className="text-xs bg-muted/40 border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            >
              <option value="All">All Operations</option>
              <option value="Physical Count">Physical Count</option>
              <option value="Cycle Count">Cycle Count</option>
              <option value="Damage Write-off">Damage Write-off</option>
              <option value="Internal Consumption">Internal Consumption</option>
              <option value="Surplus / Found">Surplus / Found</option>
              <option value="Manual">Manual Adjustments</option>
              <option value="Receipt">Receipts (PO Inbound)</option>
              <option value="SalesOrder">Sales Orders (SO Outbound)</option>
              <option value="Returns">Returns (Customer / Vendor)</option>
              {distinctReferences
                .filter(
                  (r) =>
                    ![
                      'Physical Count',
                      'Cycle Count',
                      'Damage Write-off',
                      'Internal Consumption',
                      'Surplus / Found',
                      'Manual',
                      'Receipt',
                      'SalesOrder',
                      'Customer Return',
                      'Supplier Return',
                      'Return',
                    ].includes(r)
                )
                .map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
            </select>

            {(search || typeFilter !== 'All' || refFilter !== 'All') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setTypeFilter('All');
                  setRefFilter('All');
                }}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Table / Ledger List */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5 mb-6">
          <CardContent className="p-4 flex items-center gap-3 text-destructive text-sm">
            <Icons.warning className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center justify-center space-y-3">
            <Icons.refresh className="w-7 h-7 animate-spin text-primary" />
            <p className="text-xs sm:text-sm text-muted-foreground">Loading stock movements ledger...</p>
          </CardContent>
        </Card>
      ) : filteredAdjustments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
              <Icons.stockAdjustments className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">No Stock Adjustments Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                {search || typeFilter !== 'All' || refFilter !== 'All'
                  ? 'No records match the current search or filters. Try adjusting your query.'
                  : 'No inventory adjustments recorded yet. Perform a physical shelf audit or record an adjustment.'}
              </p>
            </div>
            <Button size="sm" asChild className="gap-1.5 text-xs mt-2">
              <Link href="/stock-adjustments/new">
                <Icons.add className="w-3.5 h-3.5" />
                Record First Adjustment
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/60 border-b border-border/60 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-3.5">Product & SKU</th>
                  <th className="px-4 py-3.5 text-center">Direction</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Adjusted Qty</th>
                  <th className="px-4 py-3.5">Operation Type</th>
                  <th className="px-4 py-3.5">Reason / Note</th>
                  <th className="px-4 py-3.5 text-center">Current Stock</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredAdjustments.map((adj) => {
                  const isIn = adj.adjustment_type === 'In';
                  const unit = adj.products?.unit || 'Units';
                  return (
                    <tr key={adj.id} className="hover:bg-muted/30 transition-colors">
                      {/* Timestamp */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {new Date(adj.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Product & SKU */}
                      <td className="px-4 py-3">
                        {adj.products ? (
                          <div className="flex flex-col">
                            <Link
                              href={`/products/${adj.products.id}`}
                              className="font-medium text-foreground hover:text-primary hover:underline transition-colors line-clamp-1"
                            >
                              {adj.products.name}
                            </Link>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              SKU: {adj.products.sku_code || '—'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">Deleted / Unknown Product</span>
                        )}
                      </td>

                      {/* Direction */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Badge
                          variant={isIn ? 'success' : 'destructive'}
                          className="font-mono text-[10px] gap-1 px-2 py-0.5"
                        >
                          {isIn ? (
                            <>
                              <Icons.in className="w-3 h-3" /> + IN
                            </>
                          ) : (
                            <>
                              <Icons.out className="w-3 h-3" /> - OUT
                            </>
                          )}
                        </Badge>
                      </td>

                      {/* Adjusted Qty */}
                      <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {isIn ? '+' : '-'}{adj.quantity.toLocaleString('en-IN')}
                        </span>{' '}
                        <span className="text-[11px] font-normal text-muted-foreground">{unit}</span>
                      </td>

                      {/* Operation Type */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getReferenceBadge(adj.reference_type)}
                      </td>

                      {/* Reason / Note */}
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-foreground font-medium line-clamp-2">
                          {adj.reason || '—'}
                        </p>
                      </td>

                      {/* Current Stock */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {adj.products ? (
                          <span className="font-mono text-xs font-semibold text-primary bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
                            {Number(adj.products.current_stock).toLocaleString('en-IN')} {unit}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {adj.products && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-7 text-xs text-muted-foreground hover:text-primary gap-1"
                          >
                            <Link href={`/products/${adj.products.id}`}>
                              <span>Ledger</span>
                              <Icons.forward className="w-3 h-3" />
                            </Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t bg-muted/20 text-xs text-muted-foreground flex justify-between items-center">
            <span>Showing {filteredAdjustments.length} of {adjustments.length} transactions</span>
            <span>All entries tracked chronologically with strict audit compliance</span>
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
