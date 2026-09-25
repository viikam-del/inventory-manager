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

interface Payment {
  id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  payment_method: 'Cash' | 'UPI' | 'Cheque' | 'Bank Transfer';
  reference_number: string | null;
  notes: string | null;
  customers?: {
    company_name: string;
    phone: string;
    email: string | null;
    gstin: string | null;
  };
}

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPaymentDetails();
  }, [params.id]);

  async function fetchPaymentDetails() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('payments')
        .select('*, customers(company_name, phone, email, gstin)')
        .eq('id', params.id)
        .eq('is_deleted', false)
        .single();

      if (supabaseError) throw supabaseError;
      setPayment(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load payment details');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this payment record? This will move it to the archive.')) return;

    setActionLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('payments')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', params.id);

      if (deleteError) throw deleteError;
      router.push('/payments');
    } catch (err: any) {
      alert(err.message || 'Failed to delete payment');
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading payment details...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !payment) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Card className="max-w-md w-full border-destructive/20 text-center p-6 space-y-4">
            <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-bold">Payment Not Found</h2>
            <p className="text-muted-foreground text-xs">{error || 'The requested payment could not be located.'}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/payments">
                <Icons.back className="w-4 h-4 mr-2" /> Back to Payments
              </Link>
            </Button>
          </Card>
        </div>
      </PageContainer>
    );
  }

  const getMethodBadge = (method: Payment['payment_method']) => {
    switch (method) {
      case 'Cash': return <Badge variant="secondary">Cash</Badge>;
      case 'UPI': return <Badge variant="info">UPI</Badge>;
      case 'Cheque': return <Badge variant="warning">Cheque</Badge>;
      case 'Bank Transfer': return <Badge variant="success">Bank Transfer</Badge>;
      default: return <Badge variant="outline">{method}</Badge>;
    }
  };

  const whatsappMessage = encodeURIComponent(
    `*Payment Receipt*\nCustomer: ${payment.customers?.company_name || 'Customer'}\nAmount Received: ₹${Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nDate: ${new Date(payment.payment_date).toLocaleDateString('en-IN')}\nPayment Mode: ${payment.payment_method}\nRef/UTR: ${payment.reference_number || 'N/A'}\n\nThank you for your payment!`
  );

  return (
    <PageContainer>
      <PageHeader
        title={`Payment from ${payment.customers?.company_name || 'Unknown'}`}
        description={`Recorded on ${new Date(payment.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        backHref="/payments"
        badge={getMethodBadge(payment.payment_method)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 gap-1.5 text-xs">
              <Icons.print className="w-3.5 h-3.5" /> Print / PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1.5 text-xs bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 border-[#25D366]/30 dark:bg-[#25D366]/15 dark:text-[#25D366]"
            >
              <a
                href={`https://wa.me/?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icons.share className="w-3.5 h-3.5" /> Share WhatsApp
              </a>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.customers className="w-4 h-4 text-primary" /> Customer & Reference
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-semibold text-foreground">
                <Link href={`/customers/${payment.customer_id}`} className="hover:text-primary hover:underline">
                  {payment.customers?.company_name || 'Unknown Customer'}
                </Link>
              </span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border/60">
              <span className="text-muted-foreground">Payment Date:</span>
              <span className="font-medium text-foreground">
                {new Date(payment.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border/60">
              <span className="text-muted-foreground">Reference / UTR Number:</span>
              <span className="font-mono font-medium text-foreground">{payment.reference_number || '—'}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 sm:space-y-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 sm:p-6 flex flex-col justify-center min-h-[120px]">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Amount Received</p>
              <p className="text-3xl sm:text-4xl font-black text-foreground">
                ₹{Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          {payment.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{payment.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
