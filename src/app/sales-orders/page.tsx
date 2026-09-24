'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface SalesOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  order_date: string;
  status: 'Draft' | 'Confirmed' | 'Partially Delivered' | 'Delivered' | 'Invoiced' | 'Cancelled';
  total_amount: number;
  tally_invoice_number: string | null;
}

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const router = useRouter();

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('sales_orders')
        .select('*, customers(company_name)')
        .eq('is_deleted', false)
        .order('order_date', { ascending: false });

      if (supabaseError) throw supabaseError;

      const formatted = (data || []).map(o => ({
        ...o,
        customer_name: (o.customers as any)?.company_name
      }));

      setOrders(formatted);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sales orders');
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Orders that are Delivered or Partially Delivered but not yet Invoiced in Tally
  const pendingTallyInvoices = orders.filter(o => (o.status === 'Delivered' || o.status === 'Partially Delivered') && !o.tally_invoice_number);

  const getStatusBadge = (status: SalesOrder['status']) => {
    switch (status) {
      case 'Invoiced': return <Badge variant="info"><Icons.document className="w-3 h-3 mr-1" /> Invoiced (Tally)</Badge>;
      case 'Delivered': return <Badge variant="success"><Icons.delivered className="w-3 h-3 mr-1" /> Delivered</Badge>;
      case 'Partially Delivered': return <Badge variant="warning"><Icons.delivery className="w-3 h-3 mr-1" /> Partial Delivery</Badge>;
      case 'Confirmed': return <Badge variant="default"><Icons.success className="w-3 h-3 mr-1" /> Confirmed (Pending Dispatch)</Badge>;
      case 'Draft': return <Badge variant="secondary"><Icons.document className="w-3 h-3 mr-1" /> Draft</Badge>;
      case 'Cancelled': return <Badge variant="destructive"><Icons.close className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in slide-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales Orders</h1>
          <p className="text-muted-foreground mt-1">Manage customer orders, deliveries, and Tally invoicing</p>
        </div>
        <Button asChild>
          <Link href="/sales-orders/new">
            <Icons.add className="w-4 h-4 mr-2" /> New Sales Order
          </Link>
        </Button>
      </div>

      {pendingTallyInvoices.length > 0 && (
        <Card className="mb-6 bg-warning/10 border-warning/20">
          <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Icons.warning className="w-6 h-6 text-warning" />
              <div>
                <p className="font-bold text-warning-foreground drop-shadow-sm">Pending Tally Invoices</p>
                <p className="text-sm font-medium text-warning-foreground/80 mt-1">
                  There are {pendingTallyInvoices.length} delivered orders not yet invoiced in Tally.
                </p>
              </div>
            </div>
            <Button
              variant="warning"
              onClick={() => setStatusFilter('Delivered')}
              className="shrink-0 font-bold"
            >
              Filter Delivered <Icons.forward className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Order # or Customer..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary outline-none min-w-[200px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Partially Delivered">Partially Delivered</option>
          <option value="Delivered">Delivered</option>
          <option value="Invoiced">Invoiced</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center">
            <Icons.refresh className="animate-spin h-10 w-10 text-primary mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Loading sales orders...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 bg-destructive/10 p-6 text-center">
          <Icons.warning className="w-10 h-10 text-destructive mx-auto mb-2" />
          <p className="font-bold text-destructive">{error}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted border-b text-muted-foreground font-medium">
                <tr>
                  <th className="px-6 py-3">Order Number</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Total Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-center">Tally Inv #</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-primary">
                        {order.order_number}
                      </td>
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {order.customer_name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(order.order_date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 font-bold text-foreground">
                        ₹{Number(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {order.tally_invoice_number ? (
                          <span className="font-mono text-xs bg-muted px-2 py-1 rounded inline-block">{order.tally_invoice_number}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/sales-orders/${order.id}`}>
                            View <Icons.forward className="w-3.5 h-3.5 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      No sales orders found matching your criteria.
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
