'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

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
  const router = useRouter();

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('customers')
        .select('*')
        .eq('is_deleted', false)
        .order('company_name', { ascending: true });

      if (supabaseError) throw supabaseError;
      setCustomers(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = customers.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in slide-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground mt-1">Manage your B2B customer base, GST configurations, and credit limits</p>
        </div>
        <Button asChild>
          <Link href="/customers/new">
            <Icons.add className="w-4 h-4 mr-2" /> Add Customer
          </Link>
        </Button>
      </div>

      <div className="mb-6 relative max-w-md">
        <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by company name or phone..."
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center">
            <Icons.refresh className="animate-spin h-10 w-10 text-primary mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Loading customers...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 bg-destructive/10 p-6 text-center mb-6">
          <Icons.warning className="w-10 h-10 text-destructive mx-auto mb-2" />
          <p className="font-bold text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => fetchCustomers()}>
            Try Again
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted border-b text-muted-foreground font-medium">
                <tr>
                  <th className="px-6 py-3">Company Name</th>
                  <th className="px-6 py-3">Contact Person</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">GST Status</th>
                  <th className="px-6 py-3">Credit Limit</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {customer.company_name}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {customer.contact_person || '—'}
                      </td>
                      <td className="px-6 py-4 font-mono text-foreground">
                        {customer.phone}
                      </td>
                      <td className="px-6 py-4">
                        {customer.is_gst_customer ? (
                          <Badge variant="success">GST Registered</Badge>
                        ) : (
                          <Badge variant="outline">Non-GST</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        {customer.credit_limit ? `₹${customer.credit_limit.toLocaleString('en-IN')}` : <span className="text-muted-foreground italic">No Limit</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/customers/${customer.id}`}>
                            View <Icons.forward className="w-3.5 h-3.5 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No customers found matching your search.
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
