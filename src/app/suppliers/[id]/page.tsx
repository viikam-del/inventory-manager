'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Supplier {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  is_gst_supplier: boolean;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  default_credit_days: number;
  notes: string | null;
}

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSupplier();
  }, [params.id]);

  async function fetchSupplier() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', params.id)
        .eq('is_deleted', false)
        .single();

      if (supabaseError) throw supabaseError;
      setSupplier(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load supplier details');
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this supplier record?')) return;

    setActionLoading(true);
    try {
      const { error: supabaseError } = await supabase
        .from('suppliers')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', params.id);

      if (supabaseError) throw supabaseError;
      router.push('/suppliers');
    } catch (err: any) {
      alert(err.message || 'Failed to delete supplier');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <Icons.refresh className="animate-spin h-10 w-10 text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading supplier details...</p>
        </div>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-destructive/20 text-center p-6 space-y-4">
          <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Supplier Not Found</h2>
          <p className="text-muted-foreground text-sm">{error || 'The requested supplier could not be located.'}</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/suppliers">
              <Icons.back className="w-4 h-4 mr-2" /> Back to Suppliers
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
          <Link href="/suppliers" className="text-muted-foreground hover:text-foreground text-sm font-medium inline-flex items-center gap-1 mb-2">
            <Icons.back className="w-4 h-4" /> Back to Suppliers
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{supplier.company_name}</h1>
            {supplier.is_gst_supplier ? (
              <Badge variant="success">GST Registered</Badge>
            ) : (
              <Badge variant="outline">Non-GST</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={actionLoading}>
            <Icons.trash className="w-4 h-4 mr-1.5" /> Delete Record
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.suppliers className="w-4 h-4 text-primary" /> Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">Contact Person:</span>
              <span className="font-semibold text-foreground">{supplier.contact_person || '—'}</span>
            </div>
            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">Phone:</span>
              <span className="font-mono font-medium text-foreground">{supplier.phone}</span>
            </div>
            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">WhatsApp:</span>
              <span className="font-mono text-foreground">{supplier.whatsapp || '—'}</span>
            </div>
            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium text-foreground">{supplier.email || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Address:</span>
              <span className="font-medium text-foreground text-right max-w-[250px]">{supplier.address || '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.purchaseOrders className="w-4 h-4 text-primary" /> Business & Financials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm pb-2 border-b">
              <span className="text-muted-foreground">GSTIN:</span>
              <span className="font-mono font-medium text-foreground">{supplier.gstin || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Default Credit Days:</span>
              <span className="font-medium text-foreground">{supplier.default_credit_days} days</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Icons.payments className="w-4 h-4 text-primary" /> Banking Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex justify-between text-sm pb-2 border-b md:border-b-0 md:pr-4">
              <span className="text-muted-foreground">Bank Name:</span>
              <span className="font-medium text-foreground">{supplier.bank_name || '—'}</span>
            </div>
            <div className="flex justify-between text-sm pb-2 border-b md:border-b-0 md:pl-4">
              <span className="text-muted-foreground">Branch:</span>
              <span className="font-medium text-foreground">{supplier.bank_branch || '—'}</span>
            </div>
            <div className="flex justify-between text-sm md:pr-4">
              <span className="text-muted-foreground">Account Number:</span>
              <span className="font-mono font-medium text-foreground">{supplier.bank_account_number || '—'}</span>
            </div>
            <div className="flex justify-between text-sm md:pl-4">
              <span className="text-muted-foreground">IFSC Code:</span>
              <span className="font-mono font-medium text-foreground">{supplier.bank_ifsc || '—'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {supplier.notes && (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">{supplier.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Purchase Order Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Icons.receipts className="w-4 h-4 text-primary" /> Purchase History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8 text-sm">Purchase orders and receipt history will appear here</p>
        </CardContent>
      </Card>
    </div>
  );
}
