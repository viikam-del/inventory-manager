'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

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
  const [methodFilter, setMethodFilter] = useState<string>('All');
  const router = useRouter();

  useEffect(() => {
    fetchPayments();
  }, []);

  async function fetchPayments() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('payments')
        .select('*, customers(company_name)')
        .eq('is_deleted', false)
        .order('payment_date', { ascending: false });

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
      p.reference_number?.toLowerCase().includes(search.toLowerCase()) ||
      (p.customer_name && p.customer_name.toLowerCase().includes(search.toLowerCase()));

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in slide-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customer Payments</h1>
          <p className="text-muted-foreground mt-1">Record and track collections and settlement entries</p>
        </div>
        <Button asChild>
          <Link href="/payments/new">
            <Icons.add className="w-4 h-4 mr-2" /> Record Payment
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Reference # or Customer..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary outline-none min-w-[180px]"
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
          <div className="text-center">
            <Icons.refresh className="animate-spin h-10 w-10 text-primary mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Loading payments...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 bg-destructive/10 p-6 text-center mb-6">
          <Icons.warning className="w-10 h-10 text-destructive mx-auto mb-2" />
          <p className="font-bold text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => fetchPayments()}>
            Try Again
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted border-b text-muted-foreground font-medium">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Method</th>
                  <th className="px-6 py-3">Reference #</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPayments.length > 0 ? (
                  filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(payment.payment_date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {payment.customer_name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        {getMethodBadge(payment.payment_method)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                        {payment.reference_number || '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        ₹{Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/payments/${payment.id}`}>
                            Details <Icons.forward className="w-3.5 h-3.5 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No payments found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
