'use client';

import { useEffect, useState, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

interface Customer {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone: string;
  is_gst_customer: boolean;
  credit_limit: number | null;
  opening_balance: number;
  sales_orders?: any[];
  payments?: any[];
  _outstanding_balance?: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('customers')
        .select(`
          id, company_name, contact_person, phone, is_gst_customer, credit_limit, opening_balance,
          sales_orders ( total_amount, gst_amount, is_deleted ),
          payments ( amount, is_deleted )
        `)
        .eq('is_deleted', false)
        .order('company_name', { ascending: true }).limit(1000);

      if (supabaseError) throw supabaseError;

      const enrichedData = (data || []).map((c: any) => {
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

        return {
          ...c,
          _outstanding_balance: Number(c.opening_balance || 0) + totalSales - totalPayments
        };
      });

      setCustomers(enrichedData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    setActionLoading(customerId);
    try {
      const { error: deleteError } = await supabase
        .from('customers')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', customerId);

      if (deleteError) throw deleteError;
      setCustomers(prev => prev.filter(c => c.id !== customerId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete customer');
      setActionLoading(null);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.company_name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
    c.phone.includes(deferredSearch)
  );

  return (
    <PageContainer>
      <PageHeader
        title="Customers"
        description="Manage your B2B customer base, GST configurations, and credit limits"
        badge={
          <Badge variant="secondary" className="font-mono text-[11px]">
            {customers.length} Customers
          </Badge>
        }
        actions={
          <Button size="sm" asChild>
            <Link href="/customers/new">
              <Icons.add className="w-3.5 h-3.5 mr-1.5" />
              Add Customer
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by company name or phone..."
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
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading customers...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 text-center py-8">
          <CardContent className="space-y-3">
            <Icons.warning className="w-8 h-8 text-destructive mx-auto" />
            <p className="font-semibold text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchCustomers()}>
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
                  <th className="px-5 py-3 text-right">Outstanding</th>
                  <th className="px-5 py-3">Credit Limit</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-foreground">
                        <Link href={`/customers/${customer.id}`} className="hover:text-primary hover:underline">
                          {customer.company_name}
                        </Link>
                        {customer.is_gst_customer && (
                          <div className="mt-0.5">
                            <Badge variant="success" className="text-[9px] px-1.5 py-0">GST</Badge>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {customer.contact_person || '—'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-muted-foreground">
                        {customer.phone}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-foreground">
                        <span className={customer._outstanding_balance && customer._outstanding_balance > 0 ? "text-destructive" : "text-success"}>
                          {customer._outstanding_balance && customer._outstanding_balance < 0 ?
                            `₹${Math.abs(customer._outstanding_balance).toLocaleString('en-IN')} (Cr)` :
                            `₹${(customer._outstanding_balance || 0).toLocaleString('en-IN')}`
                          }
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {customer.credit_limit ? `₹${customer.credit_limit.toLocaleString('en-IN')}` : <span className="text-muted-foreground italic font-normal text-xs">No Limit</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 text-muted-foreground hover:text-primary" title="View Customer">
                            <Link href={`/customers/${customer.id}`}>
                              <Icons.eye className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 text-muted-foreground hover:text-primary" title="Edit Customer">
                            <Link href={`/customers/${customer.id}/edit`}>
                              <Icons.edit className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCustomer(customer.id)}
                            disabled={actionLoading === customer.id}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete Customer"
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
                        <p className="font-medium text-sm">No customers found matching your search.</p>
                        {search && (
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
