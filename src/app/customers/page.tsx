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
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const router = useRouter();

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('customers')
        .select('id, company_name, contact_person, phone, is_gst_customer, credit_limit, opening_balance')
        .eq('is_deleted', false)
        .order('company_name', { ascending: true }).limit(1000);

      if (supabaseError) throw supabaseError;
      setCustomers(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }

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
                  <th className="px-5 py-3">GST Status</th>
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
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {customer.contact_person || '—'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-muted-foreground">
                        {customer.phone}
                      </td>
                      <td className="px-5 py-3.5">
                        {customer.is_gst_customer ? (
                          <Badge variant="success">GST Registered</Badge>
                        ) : (
                          <Badge variant="outline">Non-GST</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {customer.credit_limit ? `₹${customer.credit_limit.toLocaleString('en-IN')}` : <span className="text-muted-foreground italic font-normal text-xs">No Limit</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                          <Link href={`/customers/${customer.id}`}>
                            View <Icons.forward className="w-3 h-3 ml-1" />
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
