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

interface CustomerReturn {
  id: string;
  return_number: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  original_invoice_number: string | null;
  return_date: string;
  resolution_type: 'Replacement' | 'Refund' | 'Credit Note';
  notes: string | null;
  status: 'Pending' | 'Approved' | 'Completed' | 'Rejected';
  is_restocked: boolean;
  restocked_at: string | null;
  total_amount: number;
  created_at: string;
  line_count?: number;
  total_units?: number;
}

export default function CustomerReturnsPage() {
  const [returns, setReturns] = useState<CustomerReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [resolutionFilter, setResolutionFilter] = useState<string>('All');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchReturns();
  }, []);

  async function fetchReturns() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('customer_returns')
        .select(`
          id,
          return_number,
          customer_id,
          original_invoice_number,
          return_date,
          resolution_type,
          notes,
          status,
          is_restocked,
          restocked_at,
          total_amount,
          created_at,
          customers (
            company_name,
            phone
          ),
          customer_return_lines (
            id,
            quantity_returned
          )
        `)
        .eq('is_deleted', false)
        .order('return_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000);

      if (supabaseError) throw supabaseError;

      const formatted: CustomerReturn[] = (data || []).map((r: any) => {
        const lines = r.customer_return_lines || [];
        const totalUnits = lines.reduce((acc: number, l: any) => acc + (Number(l.quantity_returned) || 0), 0);

        return {
          id: r.id,
          return_number: r.return_number,
          customer_id: r.customer_id,
          customer_name: r.customers?.company_name || 'Direct Customer',
          customer_phone: r.customers?.phone,
          original_invoice_number: r.original_invoice_number,
          return_date: r.return_date,
          resolution_type: r.resolution_type || 'Credit Note',
          notes: r.notes,
          status: r.status || 'Pending',
          is_restocked: Boolean(r.is_restocked),
          restocked_at: r.restocked_at,
          total_amount: Number(r.total_amount) || 0,
          created_at: r.created_at,
          line_count: lines.length,
          total_units: totalUnits,
        };
      });

      setReturns(formatted);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customer returns');
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteReturn = async (id: string, returnNumber: string) => {
    if (!confirm(`Move Customer Return ${returnNumber} to archive? This will soft-delete the record.`)) return;

    setActionLoading(id);
    try {
      const archivedNumber = returnNumber && !returnNumber.includes('-DEL-')
        ? `${returnNumber}-DEL-${id.slice(0, 8)}`
        : returnNumber;

      const { error: delError } = await supabase
        .from('customer_returns')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          ...(archivedNumber ? { return_number: archivedNumber } : {})
        })
        .eq('id', id);

      if (delError) throw delError;

      setReturns(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete return');
    } finally {
      setActionLoading(null);
    }
  };

  const handleQuickRestock = async (ret: CustomerReturn) => {
    if (ret.is_restocked) {
      alert(`Return ${ret.return_number} has already been restocked.`);
      return;
    }

    if (
      !confirm(
        `Restock returnable items from ${ret.return_number} back into active warehouse inventory?\n\n` +
          `• Only items in 'Good' condition will increase current stock\n` +
          `• Audit logs will be written to stock adjustments\n` +
          `• Status will be marked as Completed`
      )
    ) {
      return;
    }

    setActionLoading(ret.id);
    try {
      // 1. Fetch return lines with condition
      const { data: lines, error: linesError } = await supabase
        .from('customer_return_lines')
        .select('id, product_id, quantity_returned, condition')
        .eq('customer_return_id', ret.id);

      if (linesError) throw linesError;
      if (!lines || lines.length === 0) {
        throw new Error('This return note has no line items.');
      }

      // 2. Restock only 'Good' condition items
      for (const line of lines) {
        if (line.condition === 'Good' && Number(line.quantity_returned) > 0) {
          // Fetch current stock
          const { data: prod, error: prodErr } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', line.product_id)
            .single();

          if (prodErr) throw prodErr;

          const currentStock = Number(prod?.current_stock) || 0;
          const newStock = currentStock + Number(line.quantity_returned);

          const { error: updateErr } = await supabase
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', line.product_id);

          if (updateErr) throw updateErr;

          // Record stock adjustment
          const { error: adjErr } = await supabase
            .from('stock_adjustments')
            .insert([
              {
                product_id: line.product_id,
                adjustment_type: 'In',
                quantity: line.quantity_returned,
                reason: `Customer Return Restock: ${ret.return_number}`,
                reference_type: 'Customer Return',
                reference_id: ret.id,
              },
            ]);

          if (adjErr) throw adjErr;
        }
      }

      // 3. Mark customer return as restocked
      const { error: updateReturnError } = await supabase
        .from('customer_returns')
        .update({
          is_restocked: true,
          restocked_at: new Date().toISOString(),
          status: 'Completed',
        })
        .eq('id', ret.id);

      if (updateReturnError) throw updateReturnError;

      setReturns(prev =>
        prev.map(r =>
          r.id === ret.id
            ? {
                ...r,
                is_restocked: true,
                restocked_at: new Date().toISOString(),
                status: 'Completed',
              }
            : r
        )
      );

      alert(`Return ${ret.return_number} successfully restocked and marked as Completed!`);
    } catch (err: any) {
      alert(err.message || 'Failed to restock return');
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered Returns
  const filteredReturns = returns.filter(r => {
    const query = deferredSearch.toLowerCase();
    const matchesSearch =
      r.return_number.toLowerCase().includes(query) ||
      (r.customer_name && r.customer_name.toLowerCase().includes(query)) ||
      (r.original_invoice_number && r.original_invoice_number.toLowerCase().includes(query)) ||
      (r.notes && r.notes.toLowerCase().includes(query));

    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    const matchesResolution = resolutionFilter === 'All' || r.resolution_type === resolutionFilter;

    return matchesSearch && matchesStatus && matchesResolution;
  });

  // KPI Calculations
  const totalReturnsCount = returns.length;
  const totalReturnValue = returns.reduce((acc, r) => acc + (r.total_amount || 0), 0);
  const pendingCount = returns.filter(r => r.status === 'Pending').length;
  const restockedCount = returns.filter(r => r.is_restocked).length;

  const getStatusBadge = (status: CustomerReturn['status']) => {
    switch (status) {
      case 'Completed':
        return (
          <Badge variant="success" className="gap-1 font-mono text-[10px]">
            <Icons.check className="w-3 h-3" /> Completed
          </Badge>
        );
      case 'Approved':
        return (
          <Badge variant="info" className="gap-1 font-mono text-[10px]">
            <Icons.success className="w-3 h-3" /> Approved
          </Badge>
        );
      case 'Pending':
        return (
          <Badge variant="warning" className="gap-1 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending
          </Badge>
        );
      case 'Rejected':
        return (
          <Badge variant="destructive" className="gap-1 font-mono text-[10px]">
            <Icons.close className="w-3 h-3" /> Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getResolutionBadge = (type: CustomerReturn['resolution_type']) => {
    switch (type) {
      case 'Credit Note':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Credit Note
          </span>
        );
      case 'Refund':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Refund
          </span>
        );
      case 'Replacement':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            Replacement
          </span>
        );
      default:
        return <span className="text-xs text-muted-foreground">{type}</span>;
    }
  };

  const statuses = ['All', 'Pending', 'Approved', 'Completed', 'Rejected'];
  const resolutions = ['All', 'Replacement', 'Refund', 'Credit Note'];

  return (
    <PageContainer>
      <PageHeader
        title="Customer Returns"
        description="Process customer reverse logistics, manage replacements or credit notes, and restock inspected inventory"
        badge={
          <Badge variant="secondary" className="font-mono text-[11px]">
            {returns.length} Returns
          </Badge>
        }
        actions={
          <Button size="sm" asChild>
            <Link href="/customer-returns/new">
              <Icons.add className="w-3.5 h-3.5 mr-1.5" />
              New Customer Return
            </Link>
          </Button>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Returns"
          value={totalReturnsCount}
          icon={<Icons.returns className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
          description="Total recorded reverse shipments"
        />
        <StatCard
          title="Total Value"
          value={`₹${totalReturnValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={<Icons.payments className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />}
          description="Cumulative return valuation"
        />
        <StatCard
          title="Pending Review"
          value={pendingCount}
          icon={<Icons.warning className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />}
          description="Returns awaiting inspection/approval"
        />
        <StatCard
          title="Restocked to Stock"
          value={restockedCount}
          icon={<Icons.in className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />}
          description="Returns credited to live inventory"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search return #, customer, invoice #, remarks..."
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              <Icons.close className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Resolution Filter */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
            {resolutions.map((res) => (
              <button
                key={res}
                onClick={() => setResolutionFilter(res)}
                className={`px-2 py-0.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  resolutionFilter === res
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {res}
              </button>
            ))}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/60 overflow-x-auto">
            {statuses.map((status) => {
              const count = status === 'All'
                ? returns.length
                : returns.filter(r => r.status === status).length;
              if (count === 0 && status !== 'All') return null;

              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    statusFilter === status
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{status}</span>
                  <span
                    className={`text-[10px] px-1 rounded-full ${
                      statusFilter === status
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading customer returns...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 text-center py-8">
          <CardContent className="space-y-3">
            <Icons.warning className="w-8 h-8 text-destructive mx-auto" />
            <p className="font-semibold text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchReturns()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/60 border-b border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Return #</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Return Date</th>
                  <th className="px-5 py-3">Orig. Invoice</th>
                  <th className="px-5 py-3">Resolution</th>
                  <th className="px-5 py-3 text-right">Items / Qty</th>
                  <th className="px-5 py-3 text-right">Total Value</th>
                  <th className="px-5 py-3 text-center">Restocked</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredReturns.length > 0 ? (
                  filteredReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/customer-returns/${ret.id}`}
                          className="font-mono font-bold text-primary hover:underline flex items-center gap-1.5"
                        >
                          <Icons.returns className="w-3.5 h-3.5 text-primary/70" />
                          {ret.return_number}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        <div className="flex flex-col">
                          <span>{ret.customer_name}</span>
                          {ret.customer_phone && (
                            <span className="text-[11px] text-muted-foreground">{ret.customer_phone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                        {new Date(ret.return_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs">
                        {ret.original_invoice_number ? (
                          <span className="bg-muted/70 text-foreground px-2 py-0.5 rounded border border-border/50">
                            {ret.original_invoice_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">{getResolutionBadge(ret.resolution_type)}</td>
                      <td className="px-5 py-3.5 text-right font-mono">
                        <span className="font-semibold text-foreground">{ret.line_count}</span>{' '}
                        <span className="text-muted-foreground text-[11px]">
                          ({ret.total_units} {ret.total_units === 1 ? 'unit' : 'units'})
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold font-mono text-foreground whitespace-nowrap">
                        ₹{Number(ret.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {ret.is_restocked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <Icons.check className="w-3 h-3" /> Restocked
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                            Not Restocked
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">{getStatusBadge(ret.status)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end items-center gap-1">
                          {!ret.is_restocked && ret.status !== 'Rejected' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuickRestock(ret)}
                              disabled={actionLoading === ret.id}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                              title="Restock Good Items to Stock"
                            >
                              {actionLoading === ret.id ? (
                                <Icons.refresh className="w-4 h-4 animate-spin text-emerald-600" />
                              ) : (
                                <Icons.in className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                            title="View Return Details"
                          >
                            <Link href={`/customer-returns/${ret.id}`}>
                              <Icons.eye className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteReturn(ret.id, ret.return_number)}
                            disabled={actionLoading === ret.id}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Archive Return"
                          >
                            <Icons.trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Icons.returns className="w-8 h-8 text-muted-foreground/50" />
                        <p className="font-medium text-sm">No customer returns found matching your filters.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearch('');
                            setStatusFilter('All');
                            setResolutionFilter('All');
                          }}
                        >
                          Reset Filters
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
