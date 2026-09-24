'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

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
  const router = useRouter();

  useEffect(() => {
    fetchPOs();
  }, []);

  async function fetchPOs() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(company_name)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

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

  const filteredPOs = pos.filter(po =>
    po.po_number.toLowerCase().includes(search.toLowerCase()) ||
    (po.supplier_name && po.supplier_name.toLowerCase().includes(search.toLowerCase()))
  );

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'Received': return <Badge variant="success"><Icons.success className="w-3 h-3 mr-1" /> Received</Badge>;
      case 'Partially Received': return <Badge variant="warning"><Icons.in className="w-3 h-3 mr-1" /> Partial Receipt</Badge>;
      case 'Ordered': return <Badge variant="info"><Icons.document className="w-3 h-3 mr-1" /> Ordered</Badge>;
      case 'Cancelled': return <Badge variant="destructive"><Icons.close className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in slide-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-muted-foreground mt-1">Manage stock procurement and supplier orders</p>
        </div>
        <Button asChild>
          <Link href="/purchase-orders/new">
            <Icons.add className="w-4 h-4 mr-2" /> Create PO
          </Link>
        </Button>
      </div>

      <div className="mb-6 relative max-w-md">
        <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by PO number or supplier..."
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center">
            <Icons.refresh className="animate-spin h-10 w-10 text-primary mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Loading purchase orders...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 bg-destructive/10 p-6 text-center mb-6">
          <Icons.warning className="w-10 h-10 text-destructive mx-auto mb-2" />
          <p className="font-bold text-destructive">{error}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted border-b text-muted-foreground font-medium">
                <tr>
                  <th className="px-6 py-3">PO Number</th>
                  <th className="px-6 py-3">Supplier</th>
                  <th className="px-6 py-3">Order Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPOs.length > 0 ? (
                  filteredPOs.map((po) => (
                    <tr key={po.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-primary">{po.po_number}</td>
                      <td className="px-6 py-4 font-semibold text-foreground">{po.supplier_name || 'Unknown'}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(po.order_date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(po.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/purchase-orders/${po.id}`}>
                            View <Icons.forward className="w-3.5 h-3.5 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      No purchase orders found.
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
