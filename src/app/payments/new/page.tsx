'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';
import { logAuditEvent } from '@/lib/audit';

interface Customer {
  id: string;
  company_name: string;
  opening_balance: number;
}

function PaymentFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get('customer') || '';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    payment_number: 'Generating...',
    customer_id: initialCustomerId,
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'UPI',
    reference_number: '',
    notes: '',
  });

  useEffect(() => {
    async function loadCustomers() {
      try {
        const [customersRes, lastPaymentRes] = await Promise.all([
          supabase.from('customers').select('id, company_name, opening_balance').eq('is_deleted', false).order('company_name'),
          supabase.from('payments').select('payment_number').eq('is_deleted', false).not('payment_number', 'is', null)
        ]);

        if (customersRes.error) throw customersRes.error;
        setCustomers(customersRes.data || []);

        let maxNum = 0;
        if (lastPaymentRes.data && lastPaymentRes.data.length > 0) {
          for (const row of lastPaymentRes.data) {
            if (row.payment_number && !row.payment_number.includes('-DEL-')) {
              const match = row.payment_number.match(/PAY-(\d+)/i);
              if (match && match[1]) {
                const val = parseInt(match[1], 10);
                if (!isNaN(val) && val > maxNum) {
                  maxNum = val;
                }
              }
            }
          }
        }
        const nextNum = maxNum + 1;
        setFormData(prev => ({ ...prev, payment_number: `PAY-${String(nextNum).padStart(4, '0')}` }));
      } catch (err: any) {
        setError(err.message || 'Failed to load form data');
      } finally {
        setFetching(false);
      }
    }
    loadCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.customer_id) {
      setError('Please select a customer');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    setLoading(true);
    try {
      const { data: newPayment, error: insertError } = await supabase
        .from('payments')
        .insert([{
          payment_number: formData.payment_number,
          customer_id: formData.customer_id,
          amount: parseFloat(formData.amount),
          payment_date: formData.payment_date,
          payment_method: formData.payment_method,
          reference_number: formData.reference_number || null,
          notes: formData.notes || null,
        }])
        .select('id')
        .single();

      if (insertError) throw insertError;

      if (newPayment?.id) {
        void logAuditEvent(
          'payment',
          newPayment.id,
          'payment_received',
          null,
          {
            payment_number: formData.payment_number,
            customer_id: formData.customer_id,
            amount: parseFloat(formData.amount),
            payment_method: formData.payment_method,
            payment_date: formData.payment_date,
          }
        );
      }

      router.push('/payments');
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading form data...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Record Customer Payment"
        description="Enter details of a collection or settlement entry received from a customer"
        backHref="/payments"
      />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {error && (
          <Card className="border-destructive/30 bg-destructive/5 text-destructive p-4">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Icons.warning className="w-4 h-4 shrink-0" />
              {error}
            </div>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
            <CardDescription>Select customer, specify payment method, and amount</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Customer <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.customer_id}
                  onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select Customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Amount (₹) <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  required
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono font-semibold text-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Payment Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={formData.payment_date}
                  onChange={e => setFormData({ ...formData, payment_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Payment Method <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.payment_method}
                  onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Reference / Transaction ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR / UPI Ref # / Cheque No."
                  value={formData.reference_number}
                  onChange={e => setFormData({ ...formData, reference_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Notes / Internal Remarks
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional details about this payment receipt..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/payments">
              Cancel
            </Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Icons.refresh className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Recording Payment...
              </>
            ) : (
              <>
                <Icons.add className="w-3.5 h-3.5 mr-1.5" />
                Save Payment Entry
              </>
            )}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

export default function NewPaymentPage() {
  return (
    <Suspense fallback={
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading form...</p>
          </div>
        </div>
      </PageContainer>
    }>
      <PaymentFormContent />
    </Suspense>
  );
}
