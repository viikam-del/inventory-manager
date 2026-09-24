'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <Icons.refresh className="animate-spin h-10 w-10 text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-destructive/20 text-center p-6 space-y-4">
          <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Customer Not Found</h2>
          <p className="text-muted-foreground text-sm">{error || 'The requested customer could not be located.'}</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/customers">
              <Icons.back className="w-4 h-4 mr-2" /> Back to Customers
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-up">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/customers" className="text-muted-foreground hover:text-foreground text-sm font-medium inline-flex items-center gap-1 mb-2">
            <Icons.back className="w-4 h-4" /> Back to Customers
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{customer.company_name}</h1>
            {customer.is_gst_customer ? (
              <Badge variant="success">GST Registered</Badge>
            ) : (
              <Badge variant="outline">Non-GST</Badge>
            )}
            {customer.is_dealer && <Badge variant="secondary">Dealer</Badge>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Icons.print className="w-4 h-4 mr-2" /> Print / PDF
          </Button>

          {customer.whatsapp && (
            <Button variant="outline" size="sm" asChild className="bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 border-[#25D366]/30">
              <a
                href={`https://wa.me/${customer.whatsapp}?text=${encodeURIComponent(`Hello ${customer.contact_person ? customer.contact_person : customer.company_name},\n\nHope you are doing well!\n\nRegards,\nRainbow Digital Solutions`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icons.share className="w-4 h-4 mr-1.5" /> WhatsApp
              </a>
            </Button>
          )}

          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={actionLoading}>
            <Icons.trash className="w-4 h-4 mr-1.5" /> Delete Record
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.customers className="w-4 h-4 text-primary" /> Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">Contact Person:</span>
              <span className="font-semibold text-foreground">{customer.contact_person || '—'}</span>
            </div>
            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">Phone:</span>
              <span className="font-mono font-medium text-foreground">{customer.phone}</span>
            </div>
            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">WhatsApp:</span>
              <span className="font-mono text-foreground">{customer.whatsapp || '—'}</span>
            </div>
            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium text-foreground">{customer.email || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Address:</span>
              <span className="font-medium text-foreground text-right max-w-[250px]">{customer.address || '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.payments className="w-4 h-4 text-primary" /> GST & Financial Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">GSTIN:</span>
              <span className="font-mono font-medium text-foreground">{customer.gstin || '—'}</span>
            </div>
            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">Credit Limit:</span>
              <span className="font-bold text-foreground">
                {customer.credit_limit ? `₹${customer.credit_limit.toLocaleString('en-IN')}` : <span className="text-muted-foreground italic">No Limit</span>}
              </span>
            </div>
            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">Opening Balance:</span>
              <span className="font-semibold text-foreground">₹{customer.opening_balance.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Default Due Days:</span>
              <span className="font-medium text-foreground">{customer.default_due_days} days</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {customer.notes && (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">{customer.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Ledger Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Icons.receipts className="w-4 h-4 text-primary" /> Account Ledger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8 text-sm">Sales orders and payment transaction history will appear here</p>
        </CardContent>
      </Card>
    </div>
  );
}
