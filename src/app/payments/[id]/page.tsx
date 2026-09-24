'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    if (!confirm('Are you sure you want to delete this payment record?')) return;

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
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <Icons.refresh className="animate-spin h-10 w-10 text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-destructive/20 text-center p-6 space-y-4">
          <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Payment Not Found</h2>
          <p className="text-muted-foreground text-sm">{error || 'The requested payment could not be located.'}</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/payments">
              <Icons.back className="w-4 h-4 mr-2" /> Back to Payments
            </Link>
          </Button>
        </Card>
      </div>
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

  return (
    <div className="space-y-6 animate-in slide-up">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/payments" className="text-muted-foreground hover:text-foreground text-sm font-medium inline-flex items-center gap-1 mb-2 print:hidden">
            <Icons.back className="w-4 h-4" /> Back to Payments
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Payment Details</h1>
            {getMethodBadge(payment.payment_method)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Icons.print className="w-4 h-4 mr-2" /> Print / PDF
          </Button>

          <Button variant="outline" size="sm" asChild className="bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 border-[#25D366]/30">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`*Payment Receipt*\nCustomer: ${payment.customers?.company_name || 'Customer'}\nAmount Received: ₹${Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nDate: ${new Date(payment.payment_date).toLocaleDateString('en-IN')}\nPayment Mode: ${payment.payment_method}\nRef/UTR: ${payment.reference_number || 'N/A'}\n\nThank you for your payment!`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icons.share className="w-4 h-4 mr-1.5" /> WhatsApp
            </a>
          </Button>

          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={actionLoading}>
            <Icons.trash className="w-4 h-4 mr-1.5" /> Delete Record
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.customers className="w-4 h-4 text-primary" /> Customer & Reference
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-bold text-foreground">
                <Link href={`/customers/${payment.customer_id}`} className="hover:text-primary hover:underline">
                  {payment.customers?.company_name || 'Unknown Customer'}
                </Link>
              </span>
            </div>

            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">Payment Date:</span>
              <span className="font-medium text-foreground">{new Date(payment.payment_date).toLocaleDateString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Reference / UTR Number:</span>
              <span className="font-mono font-medium text-foreground">{payment.reference_number || '—'}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Amount Received</p>
              <p className="text-4xl font-black text-foreground">
                ₹{Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          {payment.notes && (
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">{payment.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
