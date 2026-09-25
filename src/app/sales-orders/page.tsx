'use client';

import { useEffect, useState, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

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
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<string>('All');

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('sales_orders')
        .select('id, order_number, customer_id, order_date, status, total_amount, tally_invoice_number, customers(company_name)')
        .eq('is_deleted', false)
        .order('order_date', { ascending: false }).limit(1000);

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
      o.order_number.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(deferredSearch.toLowerCase())) ||
      (o.tally_invoice_number && o.tally_invoice_number.toLowerCase().includes(deferredSearch.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingTallyInvoices = orders.filter(
    o => (o.status === 'Delivered' || o.status === 'Partially Delivered') && !o.tally_invoice_number
  );

  const getStatusBadge = (status: SalesOrder['status']) => {
    switch (status) {
      case 'Invoiced':
        return <Badge variant="info" className="gap-1"><Icons.document className="w-3 h-3" /> Invoiced</Badge>;
      case 'Delivered':
        return <Badge variant="success" className="gap-1"><Icons.delivered className="w-3 h-3" /> Delivered</Badge>;
      case 'Partially Delivered':
        return <Badge variant="warning" className="gap-1"><Icons.delivery className="w-3 h-3" /> Partial</Badge>;
      case 'Confirmed':
        return <Badge variant="default" className="gap-1"><Icons.success className="w-3 h-3" /> Confirmed</Badge>;
      case 'Draft':
        return <Badge variant="secondary" className="gap-1"><Icons.document className="w-3 h-3" /> Draft</Badge>;
      case 'Cancelled':
        return <Badge variant="destructive" className="gap-1"><Icons.close className="w-3 h-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const statuses = ['All', 'Confirmed', 'Partially Delivered', 'Delivered', 'Invoiced', 'Draft', 'Cancelled'];

  return (
    <PageContainer>
      <PageHeader
        title="Sales Orders"
        description="Monitor client order fulfillments, dispatch logistics, delivery challans, and Tally invoices"
        badge={
          <Badge variant="secondary" className="font-mono text-[11px]">
            {orders.length} Orders
          </Badge>
        }
        actions={
          <Button size="sm" asChild>
            <Link href="/sales-orders/new">
              <Icons.add className="w-3.5 h-3.5 mr-1.5" />
              New Sales Order
            </Link>
          </Button>
        }
      />

      {/* Pending Tally Invoices Notification Banner */}
      {pendingTallyInvoices.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Icons.warning className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {pendingTallyInvoices.length} Delivered Orders Awaiting Tally Invoicing
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Goods have been marked delivered but haven't been synchronized with your Tally voucher number.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusFilter('Delivered')}
              className="shrink-0 border-amber-500/30 text-foreground hover:bg-amber-500/10 text-xs"
            >
              Filter Delivered Orders <Icons.forward className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order #, customer name, Tally inv..."
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

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/60 overflow-x-auto self-start lg:self-auto">
          {statuses.map((status) => {
            const count = status === 'All'
              ? orders.length
              : orders.filter(o => o.status === status).length;
            if (count === 0 && status !== 'All') return null;

            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  statusFilter === status
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{status === 'Partially Delivered' ? 'Partial' : status}</span>
                <span className={`text-[10px] px-1 rounded-full ${
                  statusFilter === status ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading sales orders...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 text-center py-8">
          <CardContent className="space-y-3">
            <Icons.warning className="w-8 h-8 text-destructive mx-auto" />
            <p className="font-semibold text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchOrders()}>
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
                  <th className="px-5 py-3">Order #</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Order Date</th>
                  <th className="px-5 py-3">Total Value</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-center">Tally Inv #</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/sales-orders/${order.id}`}
                          className="font-mono font-bold text-primary hover:underline"
                        >
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {order.customer_name || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5 font-bold font-mono text-foreground">
                        ₹{Number(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {order.tally_invoice_number ? (
                          <span className="font-mono text-[11px] bg-muted/80 text-foreground px-2 py-0.5 rounded border border-border/50">
                            {order.tally_invoice_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                          <Link href={`/sales-orders/${order.id}`}>
                            View Order <Icons.forward className="w-3 h-3 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Icons.sales className="w-8 h-8 text-muted-foreground/60" />
                        <p className="font-medium text-sm">No sales orders found matching your filters.</p>
                        <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('All'); }}>
                          Reset Filters
                        </Button>
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
