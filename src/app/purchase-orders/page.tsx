'use client';

import { useEffect, useState, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string;
  order_date: string;
  expected_delivery_date: string | null;
  status: 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled';
  created_at: string;
}

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<string>('All');

  useEffect(() => {
    fetchPOs();
  }, []);

  async function fetchPOs() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('purchase_orders')
        .select('id, po_number, supplier_id, order_date, expected_delivery_date, status, created_at, suppliers(company_name)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }).limit(1000);

      if (supabaseError) throw supabaseError;

      const formattedData = (data || []).map(po => ({
        ...po,
        supplier_name: (po.suppliers as any)?.company_name
      }));

      setPos(formattedData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch purchase orders');
    } finally {
      setLoading(false);
    }
  }

  const filteredPOs = pos.filter(po => {
    const matchesSearch =
      po.po_number.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      (po.supplier_name && po.supplier_name.toLowerCase().includes(deferredSearch.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || po.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'Received':
        return <Badge variant="success" className="gap-1"><Icons.success className="w-3 h-3" /> Received</Badge>;
      case 'Partially Received':
        return <Badge variant="warning" className="gap-1"><Icons.in className="w-3 h-3" /> Partial Receipt</Badge>;
      case 'Ordered':
        return <Badge variant="info" className="gap-1"><Icons.document className="w-3 h-3" /> Ordered</Badge>;
      case 'Cancelled':
        return <Badge variant="destructive" className="gap-1"><Icons.close className="w-3 h-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const statuses = ['All', 'Ordered', 'Partially Received', 'Received', 'Cancelled'];

  return (
    <PageContainer>
      <PageHeader
        title="Purchase Orders"
        description="Issue procurement requests to suppliers, track incoming shipments, and generate GRN receipts"
        badge={
          <Badge variant="secondary" className="font-mono text-[11px]">
            {pos.length} Orders
          </Badge>
        }
        actions={
          <Button size="sm" asChild>
            <Link href="/purchase-orders/new">
              <Icons.add className="w-3.5 h-3.5 mr-1.5" />
              New Purchase Order
            </Link>
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by PO # or supplier..."
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
              ? pos.length
              : pos.filter(p => p.status === status).length;
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
                <span>{status === 'Partially Received' ? 'Partial' : status}</span>
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
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading purchase orders...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 text-center py-8">
          <CardContent className="space-y-3">
            <Icons.warning className="w-8 h-8 text-destructive mx-auto" />
            <p className="font-semibold text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchPOs()}>
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
                  <th className="px-5 py-3">PO Number</th>
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3">Order Date</th>
                  <th className="px-5 py-3">Expected Delivery</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredPOs.length > 0 ? (
                  filteredPOs.map((po) => (
                    <tr key={po.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/purchase-orders/${po.id}`}
                          className="font-mono font-bold text-primary hover:underline"
                        >
                          {po.po_number}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {po.supplier_name || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {new Date(po.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {po.expected_delivery_date
                          ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {getStatusBadge(po.status)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                          <Link href={`/purchase-orders/${po.id}`}>
                            View PO <Icons.forward className="w-3 h-3 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Icons.purchase className="w-8 h-8 text-muted-foreground/60" />
                        <p className="font-medium text-sm">No purchase orders found matching your filters.</p>
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
