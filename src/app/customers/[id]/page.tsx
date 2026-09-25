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

interface Customer {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  is_gst_customer: boolean;
  is_dealer: boolean;
  default_due_days: number;
  credit_limit: number | null;
  opening_balance: number;
  notes: string | null;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCustomer();
  }, [params.id]);

  async function fetchCustomer() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', params.id)
        .eq('is_deleted', false)
        .single();

      if (supabaseError) throw supabaseError;
      setCustomer(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load customer details');
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this customer record?')) return;

    setActionLoading(true);
    try {
      const { error: supabaseError } = await supabase
        .from('customers')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', params.id);

      if (supabaseError) throw supabaseError;
      router.push('/customers');
    } catch (err: any) {
      alert(err.message || 'Failed to delete customer');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading customer details...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !customer) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center px-4">
          <Card className="max-w-md w-full border-destructive/20 text-center p-6 space-y-4">
            <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-bold">Customer Not Found</h2>
            <p className="text-muted-foreground text-xs">{error || 'The requested customer could not be located.'}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/customers">
                <Icons.back className="w-4 h-4 mr-2" /> Back to Customers
              </Link>
            </Button>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={customer.company_name}
        description="Customer Account Dashboard"
        backHref="/customers"
        badge={
          <div className="flex gap-1.5">
            {customer.is_gst_customer ? (
              <Badge variant="success">GST Registered</Badge>
            ) : (
              <Badge variant="outline">Non-GST</Badge>
            )}
            {customer.is_dealer && <Badge variant="secondary">Dealer</Badge>}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 gap-1.5 text-xs">
              <Icons.print className="w-3.5 h-3.5" /> Print / PDF
            </Button>

            {customer.whatsapp && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 gap-1.5 text-xs bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 border-[#25D366]/30 dark:bg-[#25D366]/15 dark:text-[#25D366]"
              >
                <a
                  href={`https://wa.me/${customer.whatsapp}?text=${encodeURIComponent(`Hello ${customer.contact_person ? customer.contact_person : customer.company_name},\n\nHope you are doing well!\n\nRegards,\nRainbow Digital Solutions`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icons.share className="w-3.5 h-3.5" /> WhatsApp Message
                </a>
              </Button>
            )}

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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Contact Block */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3 hidden sm:flex">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.customers className="w-4 h-4 text-primary" /> Contact Details & Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 sm:pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col gap-1 pb-3 sm:pb-0 sm:border-0 border-b border-border/50">
                <span className="text-xs text-muted-foreground">Contact Person</span>
                <span className="font-semibold text-foreground">{customer.contact_person || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 pb-3 sm:pb-0 sm:border-0 border-b border-border/50">
                <span className="text-xs text-muted-foreground">Phone</span>
                <span className="font-mono font-medium text-foreground">{customer.phone}</span>
              </div>
              <div className="flex flex-col gap-1 pb-3 sm:pb-0 sm:border-0 border-b border-border/50">
                <span className="text-xs text-muted-foreground">WhatsApp</span>
                <span className="font-mono text-foreground">{customer.whatsapp || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 pb-3 sm:pb-0 sm:border-0 border-b border-border/50">
                <span className="text-xs text-muted-foreground">Email</span>
                <span className="font-medium text-foreground">{customer.email || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Address</span>
                <span className="font-medium text-foreground whitespace-pre-wrap">{customer.address || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Block */}
        <Card>
          <CardHeader className="pb-3 hidden sm:flex">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.payments className="w-4 h-4 text-primary" /> Billing & Credit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 sm:pt-0 text-sm">
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <span className="text-muted-foreground">GSTIN</span>
              <span className="font-mono font-semibold text-foreground">{customer.gstin || '—'}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Credit Limit</span>
              <span className="font-bold text-foreground">
                {customer.credit_limit ? `₹${customer.credit_limit.toLocaleString('en-IN')}` : <span className="text-muted-foreground italic font-normal text-xs">No Limit</span>}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Opening Balance</span>
              <span className="font-mono font-semibold text-foreground">₹{customer.opening_balance.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Due Term</span>
              <span className="font-medium text-foreground">{customer.default_due_days} Days</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {customer.notes && (
        <Card className="mt-4 sm:mt-6 bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Internal Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap">{customer.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Ledger UI Stub */}
      <div className="mt-6 sm:mt-8">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Icons.receipts className="w-5 h-5 text-primary" /> Account Ledger
        </h3>
        <Card className="border-dashed border-2">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Icons.search className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">No transactions available yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Sales orders and payment history linked to {customer.company_name} will automatically appear in this section.
            </p>
            <Button variant="outline" size="sm" asChild className="mt-6 h-8 text-xs">
              <Link href={`/payments/new?customer=${customer.id}`}>
                <Icons.add className="w-3.5 h-3.5 mr-1" /> Add Payment Entry
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
