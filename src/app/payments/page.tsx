'use client';

import { useEffect, useState, useDeferredValue, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';
import { cn } from '@/lib/utils';

interface Payment {
  id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  payment_method: 'Cash' | 'UPI' | 'Cheque' | 'Bank Transfer';
  reference_number: string | null;
  notes: string | null;
  customer_name?: string;
}

interface DueCustomer {
  id: string;
  company_name: string;
  due: number;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dueCustomers, setDueCustomers] = useState<DueCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [methodFilter, setMethodFilter] = useState<string>('All');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [paymentsRes, customersRes] = await Promise.all([
        supabase
          .from('payments')
          .select('id, customer_id, amount, payment_date, payment_method, reference_number, notes, customers(company_name)')
          .eq('is_deleted', false)
          .order('payment_date', { ascending: false })
          .limit(1000),
        supabase
          .from('customers')
          .select(`
            id, company_name, opening_balance,
            sales_orders ( total_amount, gst_amount, is_deleted ),
            payments ( amount, is_deleted )
          `)
          .eq('is_deleted', false)
          .order('company_name', { ascending: true })
          .limit(1000)
      ]);

      if (paymentsRes.error) throw paymentsRes.error;
      if (customersRes.error) throw customersRes.error;

      const formattedPayments: Payment[] = (paymentsRes.data || []).map((p: any) => ({
        ...p,
        customer_name: (p.customers as any)?.company_name
      }));
      setPayments(formattedPayments);

      // Compute live customer balances
      const calculatedDues: DueCustomer[] = [];
      (customersRes.data || []).forEach((c: any) => {
        let totalSales = 0;
        let totalPayments = 0;

        if (c.sales_orders) {
          totalSales = c.sales_orders
            .filter((o: any) => !o.is_deleted)
            .reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0) + (Number(o.gst_amount) || 0), 0);
        }

        if (c.payments) {
          totalPayments = c.payments
            .filter((p: any) => !p.is_deleted)
            .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        }

        const balance = Number(c.opening_balance || 0) + totalSales - totalPayments;
        if (balance > 0) {
          calculatedDues.push({
            id: c.id,
            company_name: c.company_name,
            due: balance
          });
        }
      });

      // Sort by highest outstanding balance first
      calculatedDues.sort((a, b) => b.due - a.due);
      setDueCustomers(calculatedDues);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payments and customer receivables');
    } finally {
      setLoading(false);
    }
  }

  // Dashboard KPI metrics
  const totalOutstandingDue = useMemo(() => {
    return dueCustomers.reduce((acc, c) => acc + c.due, 0);
  }, [dueCustomers]);

  const { collectedThisMonth, thisMonthCount, currentMonthLabel } = useMemo(() => {
    const now = new Date();
    const yyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = now.toLocaleString('en-IN', { month: 'short', year: 'numeric' });

    const monthPayments = payments.filter(p => p.payment_date && p.payment_date.startsWith(yyyyMm));
    const total = monthPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

    return {
      collectedThisMonth: total,
      thisMonthCount: monthPayments.length,
      currentMonthLabel: monthLabel
    };
  }, [payments]);

  const selectedCustomerObj = useMemo(() => {
    if (!selectedCustomerId) return null;
    return (
      dueCustomers.find(c => c.id === selectedCustomerId) ||
      payments.find(p => p.customer_id === selectedCustomerId)?.customer_name
    );
  }, [selectedCustomerId, dueCustomers, payments]);

  const filteredPayments = payments.filter(p => {
    const matchesSearch =
      p.reference_number?.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      (p.customer_name && p.customer_name.toLowerCase().includes(deferredSearch.toLowerCase()));

    const matchesMethod = methodFilter === 'All' || p.payment_method === methodFilter;
    const matchesCustomer = !selectedCustomerId || p.customer_id === selectedCustomerId;

    return matchesSearch && matchesMethod && matchesCustomer;
  });

  const getMethodBadge = (method: Payment['payment_method']) => {
    switch (method) {
      case 'Cash': return <Badge variant="secondary">Cash</Badge>;
      case 'UPI': return <Badge variant="info">UPI</Badge>;
      case 'Cheque': return <Badge variant="warning">Cheque</Badge>;
      case 'Bank Transfer': return <Badge variant="success">Bank Transfer</Badge>;
      default: return <Badge variant="outline">{method}</Badge>;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Customer Payments"
        description="Record and track collections, customer settlement entries, and pending dues"
        badge={
          <Badge variant="secondary" className="font-mono text-[11px]">
            {payments.length} Payments
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => loadData()} disabled={loading} className="h-8 text-xs gap-1.5">
              <Icons.refresh className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" asChild className="h-8 text-xs">
              <Link href="/payments/new">
                <Icons.add className="w-3.5 h-3.5 mr-1" />
                Record Payment
              </Link>
            </Button>
          </div>
        }
      />

      {/* Option 1: Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          title="Total Outstanding Due"
          value={`₹${totalOutstandingDue.toLocaleString('en-IN')}`}
          icon={<Icons.receipts className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
          iconClassName="bg-rose-500/10 border-rose-500/20"
          description={
            dueCustomers.length > 0
              ? `Across ${dueCustomers.length} due accounts`
              : 'All accounts settled'
          }
        />

        <StatCard
          title="Collected This Month"
          value={`₹${collectedThisMonth.toLocaleString('en-IN')}`}
          icon={<Icons.payments className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          iconClassName="bg-emerald-500/10 border-emerald-500/20"
          description={`${thisMonthCount} payment${thisMonthCount === 1 ? '' : 's'} in ${currentMonthLabel}`}
        />

        <StatCard
          title="Due Accounts"
          value={dueCustomers.length}
          icon={<Icons.customers className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          iconClassName="bg-amber-500/10 border-amber-500/20"
          description={
            dueCustomers.length > 0 && dueCustomers[0]
              ? `Highest: ${dueCustomers[0].company_name} (₹${dueCustomers[0].due.toLocaleString('en-IN')})`
              : 'Zero accounts with pending dues'
          }
        />
      </div>

      {/* Top Due Customer Quick Action Strip */}
      <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              Outstanding Receivables by Customer
            </h3>
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
              {dueCustomers.length} {dueCustomers.length === 1 ? 'Pending' : 'Pending'}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {selectedCustomerId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCustomerId(null)}
                className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2"
              >
                Clear Customer Filter
                <Icons.close className="w-3 h-3" />
              </Button>
            )}
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Click a customer to filter receipts
            </span>
          </div>
        </div>

        {dueCustomers.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/60">
            All customer accounts are clear of pending dues!
          </div>
        ) : (
          <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
            {dueCustomers.map((cust) => {
              const isSelected = selectedCustomerId === cust.id;
              return (
                <div
                  key={cust.id}
                  onClick={() => setSelectedCustomerId(isSelected ? null : cust.id)}
                  className={cn(
                    "shrink-0 rounded-lg border p-3 min-w-[240px] max-w-[280px] flex flex-col justify-between transition-all duration-150 cursor-pointer select-none",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                      : "border-border/70 bg-background hover:bg-muted/40 hover:border-border"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="font-semibold text-xs text-foreground truncate block leading-tight" title={cust.company_name}>
                        {cust.company_name}
                      </span>
                      {isSelected && (
                        <Badge variant="default" className="text-[9px] px-1 py-0 h-3.5 shrink-0">
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between pt-0.5">
                      <span className="text-[11px] text-muted-foreground">Due Amount</span>
                      <span className="font-mono font-bold text-sm text-destructive">
                        ₹{cust.due.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/customers/${cust.id}`}
                      className="text-[11px] text-muted-foreground hover:text-primary hover:underline flex items-center gap-1"
                    >
                      <Icons.eye className="w-3 h-3" /> Ledger
                    </Link>

                    <Button
                      size="sm"
                      asChild
                      className="h-6 text-[11px] px-2 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Link href={`/payments/new?customer=${cust.id}`}>
                        <Icons.add className="w-3 h-3" /> Collect
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Customer Filter Banner if set */}
      {selectedCustomerId && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs">
          <div className="flex items-center gap-2">
            <Icons.filter className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">Filtered to payments by:</span>
            <span className="font-semibold text-foreground">
              {typeof selectedCustomerObj === 'string'
                ? selectedCustomerObj
                : selectedCustomerObj?.company_name || 'Selected Customer'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCustomerId(null)}
            className="h-6 px-2 text-[11px] text-primary hover:bg-primary/15"
          >
            Show All Customers
          </Button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Reference # or Customer..."
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
        <select
          className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[150px]"
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
        >
          <option value="All">All Methods</option>
          <option value="Cash">Cash</option>
          <option value="UPI">UPI</option>
          <option value="Cheque">Cheque</option>
          <option value="Bank Transfer">Bank Transfer</option>
        </select>
      </div>

      {loading ? (
        <div className="min-h-[30vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading payments and dues...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 text-center py-8">
          <CardContent className="space-y-3">
            <Icons.warning className="w-8 h-8 text-destructive mx-auto" />
            <p className="font-semibold text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => loadData()}>
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
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Reference #</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredPayments.length > 0 ? (
                  filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {new Date(payment.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        <Link
                          href={`/customers/${payment.customer_id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {payment.customer_name || 'Unknown'}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        {getMethodBadge(payment.payment_method)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {payment.reference_number || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-foreground">
                        ₹{Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                          <Link href={`/payments/${payment.id}`}>
                            Details <Icons.forward className="w-3 h-3 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Icons.search className="w-8 h-8 text-muted-foreground/60" />
                        <p className="font-medium text-sm">No payments found matching your filters.</p>
                        {(search || methodFilter !== 'All' || selectedCustomerId) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSearch('');
                              setMethodFilter('All');
                              setSelectedCustomerId(null);
                            }}
                          >
                            Clear All Filters
                          </Button>
                        )}
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

