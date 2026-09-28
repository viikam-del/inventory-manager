'use client';

import { useEffect, useState, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

interface Supplier {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone: string;
  is_gst_supplier: boolean;
  default_credit_days: number;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('suppliers')
        .select('id, company_name, contact_person, phone, is_gst_supplier, default_credit_days')
        .eq('is_deleted', false)
        .order('company_name', { ascending: true }).limit(1000);

      if (supabaseError) throw supabaseError;
      setSuppliers(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    setActionLoading(supplierId);
    try {
      const { error: deleteError } = await supabase
        .from('suppliers')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', supplierId);

      if (deleteError) throw deleteError;
      setSuppliers(prev => prev.filter(s => s.id !== supplierId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete supplier');
      setActionLoading(null);
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.company_name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
    s.phone.includes(deferredSearch)
  );

  return (
    <PageContainer>
      <PageHeader
        title="Suppliers"
        description="Manage vendor contacts, credit periods, and procurement sources"
        badge={
          <Badge variant="secondary" className="font-mono text-[11px]">
            {suppliers.length} Suppliers
          </Badge>
        }
        actions={
          <Button size="sm" asChild>
            <Link href="/suppliers/new">
              <Icons.add className="w-3.5 h-3.5 mr-1.5" />
              Add Supplier
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by supplier name or phone..."
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
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading suppliers...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 text-center py-8">
          <CardContent className="space-y-3">
            <Icons.warning className="w-8 h-8 text-destructive mx-auto" />
            <p className="font-semibold text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchSuppliers()}>
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
                  <th className="px-5 py-3">Company Name</th>
                  <th className="px-5 py-3">Contact Person</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">GST Status</th>
                  <th className="px-5 py-3">Credit Term</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-foreground">
                        <Link href={`/suppliers/${supplier.id}`} className="hover:text-primary hover:underline">
                          {supplier.company_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {supplier.contact_person || '—'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-muted-foreground">
                        {supplier.phone}
                      </td>
                      <td className="px-5 py-3.5">
                        {supplier.is_gst_supplier ? (
                          <Badge variant="success">GST Registered</Badge>
                        ) : (
                          <Badge variant="outline">Non-GST</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {supplier.default_credit_days} days
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 text-muted-foreground hover:text-primary" title="View Supplier">
                            <Link href={`/suppliers/${supplier.id}`}>
                              <Icons.eye className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 text-muted-foreground hover:text-primary" title="Edit Supplier">
                            <Link href={`/suppliers/${supplier.id}/edit`}>
                              <Icons.edit className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSupplier(supplier.id)}
                            disabled={actionLoading === supplier.id}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete Supplier"
                          >
                            <Icons.trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Icons.search className="w-8 h-8 text-muted-foreground/60" />
                        <p className="font-medium text-sm">No suppliers found matching your search.</p>
                        {deferredSearch && (
                          <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                            Clear Search
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
