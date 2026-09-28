'use client';

import { useEffect, useState, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

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

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [methodFilter, setMethodFilter] = useState<string>('All');

  useEffect(() => {
    fetchPayments();
  }, []);

  async function fetchPayments() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('payments')
        .select('id, customer_id, amount, payment_date, payment_method, reference_number, notes, customers(company_name)')
        .eq('is_deleted', false)
        .order('payment_date', { ascending: false }).limit(1000);

      if (supabaseError) throw supabaseError;

      const formatted = (data || []).map(p => ({
        ...p,
        customer_name: (p.customers as any)?.company_name
      }));

      setPayments(formatted);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  }

  const filteredPayments = payments.filter(p => {
    const matchesSearch =
      p.reference_number?.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      (p.customer_name && p.customer_name.toLowerCase().includes(deferredSearch.toLowerCase()));

    const matchesMethod = methodFilter === 'All' || p.payment_method === methodFilter;

    return matchesSearch && matchesMethod;
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
        description="Record and track collections and settlement entries"
        badge={
          <Badge variant="secondary" className="font-mono text-[11px]">
            {payments.length} Payments
          </Badge>
        }
        actions={
          <Button size="sm" asChild>
            <Link href="/payments/new">
              <Icons.add className="w-3.5 h-3.5 mr-1.5" />
              Record Payment
            </Link>
          </Button>
        }
      />

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
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading payments...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 text-center py-8">
          <CardContent className="space-y-3">
            <Icons.warning className="w-8 h-8 text-destructive mx-auto" />
            <p className="font-semibold text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchPayments()}>
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
                        <p className="font-medium text-sm">No payments found matching your search.</p>
                        {(search || methodFilter !== 'All') && (
                          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setMethodFilter('All'); }}>
                            Clear Filters
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
