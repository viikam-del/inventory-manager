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

interface SupplierReturn {
  id: string;
  return_number: string;
  supplier_id: string;
  supplier_name?: string;
  supplier_phone?: string;
  original_po_number: string | null;
  return_date: string;
  resolution_type: 'Replacement' | 'Refund' | 'Credit Note';
  notes: string | null;
  status: 'Draft' | 'Pending' | 'Shipped' | 'Completed' | 'Cancelled';
  is_stock_deducted: boolean;
  stock_deducted_at: string | null;
  total_amount: number;
  created_at: string;
  line_count?: number;
  total_units?: number;
}

export default function SupplierReturnsPage() {
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [resolutionFilter, setResolutionFilter] = useState<string>('All');
  const [stockFilter, setStockFilter] = useState<string>('All');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchReturns();
  }, []);

  async function fetchReturns() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('supplier_returns')
        .select(`
          id,
          return_number,
          supplier_id,
          original_po_number,
          return_date,
          resolution_type,
          notes,
          status,
          is_stock_deducted,
          stock_deducted_at,
          total_amount,
          created_at,
          suppliers (
            company_name,
            phone
          ),
          supplier_return_lines (
            id,
            quantity_returned
          )
        `)
        .eq('is_deleted', false)
        .order('return_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000);

      if (supabaseError) throw supabaseError;

      const formatted: SupplierReturn[] = (data || []).map((r: any) => {
        const lines = r.supplier_return_lines || [];
        const totalUnits = lines.reduce((acc: number, l: any) => acc + (Number(l.quantity_returned) || 0), 0);

        return {
          id: r.id,
          return_number: r.return_number,
          supplier_id: r.supplier_id,
          supplier_name: r.suppliers?.company_name || 'Direct Supplier',
          supplier_phone: r.suppliers?.phone,
          original_po_number: r.original_po_number,
          return_date: r.return_date,
          resolution_type: r.resolution_type || 'Credit Note',
          notes: r.notes,
          status: r.status || 'Draft',
          is_stock_deducted: Boolean(r.is_stock_deducted),
          stock_deducted_at: r.stock_deducted_at,
          total_amount: Number(r.total_amount) || 0,
          created_at: r.created_at,
          line_count: lines.length,
          total_units: totalUnits,
        };
      });

      setReturns(formatted);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch supplier returns');
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteReturn = async (id: string, returnNumber: string) => {
    if (!confirm(`Move Supplier Return ${returnNumber} to archive? This will soft-delete the record.`)) return;

    setActionLoading(id);
    try {
      const archivedNumber = returnNumber && !returnNumber.includes('-DEL-')
        ? `${returnNumber}-DEL-${id.slice(0, 8)}`
        : returnNumber;

      const { error: delError } = await supabase
        .from('supplier_returns')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          ...(archivedNumber ? { return_number: archivedNumber } : {})
        })
        .eq('id', id);

      if (delError) throw delError;

      setReturns(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete supplier return');
    } finally {
      setActionLoading(null);
    }
  };

  const handleQuickDeductStock = async (ret: SupplierReturn) => {
    if (ret.is_stock_deducted) {
      alert(`Return ${ret.return_number} has already been deducted from stock.`);
      return;
    }

    if (
      !confirm(
        `Deduct returned items for ${ret.return_number} from warehouse inventory?\n\n` +
          `• Stock levels will be reduced for each returned product\n` +
          `• Audit logs will be inserted into stock adjustments ('Out' / 'Supplier Return')\n` +
          `• Return status will advance to 'Shipped'`
      )
    ) {
      return;
    }

    setActionLoading(ret.id);
    try {
      // 1. Fetch return lines
      const { data: lines, error: linesError } = await supabase
        .from('supplier_return_lines')
        .select('id, product_id, quantity_returned')
        .eq('supplier_return_id', ret.id);

      if (linesError) throw linesError;
      if (!lines || lines.length === 0) {
        throw new Error('This return note has no line items.');
      }

      // 2. Decrement stock and create stock adjustment audit
      for (const line of lines) {
        if (line.product_id && Number(line.quantity_returned) > 0) {
          const { data: prod, error: prodErr } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', line.product_id)
            .single();

          if (prodErr) throw prodErr;

          const currentStock = Number(prod?.current_stock) || 0;
          const newStock = Math.max(0, currentStock - Number(line.quantity_returned));

          const { error: updateErr } = await supabase
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', line.product_id);

          if (updateErr) throw updateErr;

          // Record stock adjustment (Out)
          const { error: adjErr } = await supabase
            .from('stock_adjustments')
            .insert([
              {
                product_id: line.product_id,
                adjustment_type: 'Out',
                quantity: Number(line.quantity_returned),
                reason: `Supplier Return: ${ret.return_number}`,
                reference_type: 'Supplier Return',
                reference_id: ret.id,
              },
            ]);

          if (adjErr) throw adjErr;
        }
      }

      // 3. Mark return as deducted and update status to 'Shipped' if Draft/Pending
      const nextStatus = ret.status === 'Draft' || ret.status === 'Pending' ? 'Shipped' : ret.status;
      const { error: updateReturnError } = await supabase
        .from('supplier_returns')
        .update({
          is_stock_deducted: true,
          stock_deducted_at: new Date().toISOString(),
          status: nextStatus,
        })
        .eq('id', ret.id);

      if (updateReturnError) throw updateReturnError;

      setReturns(prev =>
        prev.map(r =>
          r.id === ret.id
            ? {
                ...r,
                is_stock_deducted: true,
                stock_deducted_at: new Date().toISOString(),
                status: nextStatus as any,
              }
            : r
        )
      );

      alert(`Stock successfully deducted for ${ret.return_number} and audit logs recorded.`);
    } catch (err: any) {
      alert(err.message || 'Failed to deduct stock');
    } finally {
      setActionLoading(null);
    }
  };

  // KPI Calculations
  const totalReturnsCount = returns.length;
  const totalReturnValue = returns.reduce((acc, r) => acc + (r.total_amount || 0), 0);
  const pendingActionCount = returns.filter(r => !r.is_stock_deducted && r.status !== 'Cancelled').length;
  const stockDeductedCount = returns.filter(r => r.is_stock_deducted).length;

  // Filter returns
  const filteredReturns = returns.filter(r => {
    const q = deferredSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.return_number.toLowerCase().includes(q) ||
      (r.supplier_name && r.supplier_name.toLowerCase().includes(q)) ||
      (r.supplier_phone && r.supplier_phone.toLowerCase().includes(q)) ||
      (r.original_po_number && r.original_po_number.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    const matchesResolution = resolutionFilter === 'All' || r.resolution_type === resolutionFilter;
    const matchesStock =
      stockFilter === 'All' ||
      (stockFilter === 'Deducted' && r.is_stock_deducted) ||
      (stockFilter === 'Pending' && !r.is_stock_deducted);

    return matchesSearch && matchesStatus && matchesResolution && matchesStock;
  });

  const getStatusBadge = (status: SupplierReturn['status']) => {
    switch (status) {
      case 'Completed':
        return <Badge variant="success">Completed</Badge>;
      case 'Shipped':
        return <Badge variant="info">Shipped</Badge>;
      case 'Pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'Draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'Cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getResolutionBadge = (resolution: SupplierReturn['resolution_type']) => {
    switch (resolution) {
      case 'Credit Note':
        return (
          <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50/50 dark:border-indigo-900/60 dark:text-indigo-400 dark:bg-indigo-950/30">
            Credit Note
          </Badge>
        );
      case 'Refund':
        return (
          <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50/50 dark:border-emerald-900/60 dark:text-emerald-400 dark:bg-emerald-950/30">
            Refund
          </Badge>
        );
      case 'Replacement':
        return (
          <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50/50 dark:border-blue-900/60 dark:text-blue-400 dark:bg-blue-950/30">
            Replacement
          </Badge>
        );
      default:
        return <Badge variant="outline">{resolution}</Badge>;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Supplier Returns"
        description="Manage purchase returns, debit notes, vendor settlements, and reverse stock deductions."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchReturns} disabled={loading} size="sm">
              <Icons.refresh className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button asChild size="sm">
              <Link href="/supplier-returns/new">
                <Icons.add className="w-4 h-4 mr-2" />
                New Supplier Return
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Returns"
          value={totalReturnsCount}
          description="Total supplier return records"
          icon={<Icons.returns className="w-5 h-5 text-primary" />}
        />
        <StatCard
          title="Total Return Value"
          value={`₹${totalReturnValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          description="Aggregate return value"
          icon={<Icons.payments className="w-5 h-5 text-indigo-500" />}
        />
        <StatCard
          title="Pending Deduction"
          value={pendingActionCount}
          description="Returns awaiting warehouse dispatch"
          icon={<Icons.warning className="w-5 h-5 text-amber-500" />}
        />
        <StatCard
          title="Stock Deducted"
          value={stockDeductedCount}
          description="Inventory reduced & audited"
          icon={<Icons.success className="w-5 h-5 text-emerald-500" />}
        />
      </div>

      {/* Filters and Search Bar */}
      <Card className="mb-6 shadow-xs border-border/70">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search return #, supplier, PO..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-muted/40 border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary focus:bg-background transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex items-center bg-muted/60 p-1 rounded-lg border text-xs">
                <span className="px-2 font-medium text-muted-foreground hidden sm:inline">Status:</span>
                {(['All', 'Draft', 'Pending', 'Shipped', 'Completed', 'Cancelled'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                      statusFilter === st
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex items-center bg-muted/60 p-1 rounded-lg border text-xs">
                <span className="px-2 font-medium text-muted-foreground hidden sm:inline">Stock:</span>
                {(['All', 'Pending', 'Deducted'] as const).map(sf => (
                  <button
                    key={sf}
                    onClick={() => setStockFilter(sf)}
                    className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                      stockFilter === sf
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Secondary Resolution Filters */}
          <div className="flex items-center gap-2 pt-2 border-t text-xs">
            <span className="text-muted-foreground font-medium">Settlement Resolution:</span>
            {(['All', 'Credit Note', 'Replacement', 'Refund'] as const).map(res => (
              <button
                key={res}
                onClick={() => setResolutionFilter(res)}
                className={`px-2 py-0.5 rounded-md border transition-all ${
                  resolutionFilter === res
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Table / Data Listing */}
      <Card className="shadow-xs border-border/70 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-medium text-xs">
              <tr>
                <th className="py-3 px-4">Return #</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Orig. PO</th>
                <th className="py-3 px-4">Resolution</th>
                <th className="py-3 px-4">Items / Qty</th>
                <th className="py-3 px-4 text-right">Total Value</th>
                <th className="py-3 px-4 text-center">Stock Status</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <Icons.refresh className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading supplier returns...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-destructive">
                    <Icons.warning className="w-6 h-6 mx-auto mb-2" />
                    {error}
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="max-w-xs mx-auto">
                      <Icons.returns className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="font-semibold text-foreground">No supplier returns found</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">
                        {search || statusFilter !== 'All' || resolutionFilter !== 'All' || stockFilter !== 'All'
                          ? 'Try adjusting your search criteria or active filters.'
                          : 'Create your first supplier return to record returned purchase goods and debit notes.'}
                      </p>
                      <Button asChild size="sm">
                        <Link href="/supplier-returns/new">
                          <Icons.add className="w-4 h-4 mr-2" />
                          New Supplier Return
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReturns.map(ret => (
                  <tr key={ret.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="py-3 px-4 font-mono font-bold text-primary">
                      <Link href={`/supplier-returns/${ret.id}`} className="hover:underline flex items-center gap-1.5">
                        <Icons.document className="w-3.5 h-3.5 text-muted-foreground" />
                        {ret.return_number}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{ret.supplier_name}</div>
                      {ret.supplier_phone && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Icons.phone className="w-3 h-3" />
                          {ret.supplier_phone}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-mono text-xs">
                      {ret.return_date}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                      {ret.original_po_number ? (
                        <Badge variant="outline" className="font-mono text-[11px] font-normal">
                          {ret.original_po_number}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getResolutionBadge(ret.resolution_type)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      <span className="font-semibold text-foreground">{ret.line_count || 0}</span> lines
                      <span className="text-muted-foreground ml-1">({ret.total_units || 0} units)</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-foreground whitespace-nowrap">
                      ₹{ret.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {ret.is_stock_deducted ? (
                        <Badge variant="success" className="gap-1 font-mono text-[11px]">
                          <Icons.check className="w-3 h-3" />
                          Deducted
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="gap-1 font-mono text-[11px]">
                          <Icons.out className="w-3 h-3" />
                          Pending Deduction
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {getStatusBadge(ret.status)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {!ret.is_stock_deducted && ret.status !== 'Cancelled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            onClick={() => handleQuickDeductStock(ret)}
                            disabled={actionLoading === ret.id}
                            title="Deduct items from warehouse inventory"
                          >
                            <Icons.out className="w-3.5 h-3.5 mr-1" />
                            Deduct
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                          <Link href={`/supplier-returns/${ret.id}`} title="View Details">
                            <Icons.forward className="w-4 h-4 text-muted-foreground" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteReturn(ret.id, ret.return_number)}
                          disabled={actionLoading === ret.id}
                          title="Archive Return"
                        >
                          <Icons.trash className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}
