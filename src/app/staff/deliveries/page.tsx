'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OrderLine {
  id: string;
  quantity: number;
  product_id: string;
  products?: {
    name: string;
    unit: string;
  };
}

interface DeliveryOrder {
  id: string;
  order_number: string;
  order_date: string;
  status: 'Confirmed' | 'Partially Delivered' | 'Delivered' | 'Invoiced';
  total_amount: number;
  customer_id: string;
  delivery_method?: string;
  tally_invoice_number?: string | null;
  created_at?: string;
  customers?: {
    company_name: string;
    phone: string;
    address?: string;
  };
  sales_order_lines?: OrderLine[];
}

export default function StaffDeliveriesPage() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'delivered'>('pending');
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('rds_staff_user');
    if (!storedUser) {
      router.push('/staff/login');
      return;
    }
    try {
      setUser(JSON.parse(storedUser));
    } catch {
      router.push('/staff/login');
      return;
    }

    fetchDeliveries();
  }, [router]);

  async function fetchDeliveries() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          id,
          order_number,
          order_date,
          status,
          total_amount,
          customer_id,
          delivery_method,
          tally_invoice_number,
          created_at,
          customers (company_name, phone),
          sales_order_lines (id, quantity, product_id, products (name, unit))
        `)
        .eq('is_deleted', false)
        .in('status', ['Confirmed', 'Partially Delivered', 'Delivered', 'Invoiced'])
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data cleanly
      const formatted = (data || []).map((o: any) => ({
        ...o,
        customers: Array.isArray(o.customers) ? o.customers[0] : o.customers,
        sales_order_lines: o.sales_order_lines || [],
      }));

      setOrders(formatted);
    } catch (err: any) {
      console.error('Failed to load deliveries:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('rds_staff_user');
    router.push('/staff/login');
  };

  const markOrderDelivered = async (order: DeliveryOrder) => {
    if (!confirm(`Confirm delivery for order ${order.order_number}? Stock levels will be updated.`)) return;

    setActionLoadingId(order.id);
    try {
      // 1. Reduce stock for each product in order lines
      if (order.sales_order_lines && order.sales_order_lines.length > 0) {
        for (const line of order.sales_order_lines) {
          const { data: prod } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', line.product_id)
            .single();

          const curr = Number(prod?.current_stock) || 0;
          const updated = curr - Number(line.quantity);

          await supabase
            .from('products')
            .update({ current_stock: updated })
            .eq('id', line.product_id);

          await supabase.from('stock_adjustments').insert([
            {
              product_id: line.product_id,
              adjustment_type: 'Out',
              quantity: line.quantity,
              reason: `Staff Mobile Delivery: ${order.order_number}`,
              reference_type: 'SalesOrder',
              reference_id: order.id,
            },
          ]);
        }
      }

      // 2. Update status to Delivered
      const { error: updateErr } = await supabase
        .from('sales_orders')
        .update({ status: 'Delivered' })
        .eq('id', order.id);

      if (updateErr) throw updateErr;

      // Local state update
      setOrders(prev =>
        prev.map(o => (o.id === order.id ? { ...o, status: 'Delivered' } : o))
      );
    } catch (err: any) {
      alert(err.message || 'Error updating order status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const markPartialDelivery = async (order: DeliveryOrder) => {
    if (!confirm(`Mark order ${order.order_number} as Partial Delivery?`)) return;

    setActionLoadingId(order.id);
    try {
      const { error: updateErr } = await supabase
        .from('sales_orders')
        .update({ status: 'Partially Delivered' })
        .eq('id', order.id);

      if (updateErr) throw updateErr;

      setOrders(prev =>
        prev.map(o => (o.id === order.id ? { ...o, status: 'Partially Delivered' } : o))
      );
    } catch (err: any) {
      alert(err.message || 'Error updating order status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const pendingOrders = orders.filter(
    o => o.status === 'Confirmed' || o.status === 'Partially Delivered'
  );
  const completedOrders = orders.filter(
    o => o.status === 'Delivered' || o.status === 'Invoiced'
  );

  const displayedOrders = (activeTab === 'pending' ? pendingOrders : completedOrders).filter(
    o =>
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (o.customers?.company_name && o.customers.company_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col pb-12">
      {/* Mobile Sticky Header */}
      <header className="sticky top-0 z-40 bg-slate-800/90 backdrop-blur border-b border-slate-700/60 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold">
            <Icons.delivery className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">RDS Delivery Staff</h1>
            <p className="text-xs text-slate-400">{user?.name || 'Driver'}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-white">
          <Icons.logout className="w-4 h-4 mr-1" /> Logout
        </Button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Icons.search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search order # or customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Tab Filters */}
        <div className="grid grid-cols-2 gap-2 bg-slate-800/60 p-1 rounded-xl border border-slate-700/50">
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              "py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
              activeTab === 'pending'
                ? "bg-primary text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Pending / In-Transit
            <Badge variant="secondary" className="bg-slate-700 text-slate-200 px-1.5 py-0 text-[10px]">
              {pendingOrders.length}
            </Badge>
          </button>

          <button
            onClick={() => setActiveTab('delivered')}
            className={cn(
              "py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
              activeTab === 'delivered'
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Completed
            <Badge variant="secondary" className="bg-slate-700 text-slate-200 px-1.5 py-0 text-[10px]">
              {completedOrders.length}
            </Badge>
          </button>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="py-16 text-center">
            <Icons.refresh className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
            <p className="text-slate-400 text-xs">Fetching delivery dispatches...</p>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="py-12 text-center bg-slate-800/30 rounded-xl border border-slate-800 p-6">
            <Icons.delivery className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-300 font-medium text-sm">No dispatches found</p>
            <p className="text-slate-500 text-xs mt-1">There are no orders matching this tab or search.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedOrders.map(order => {
              const isActioning = actionLoadingId === order.id;

              return (
                <Card key={order.id} className="bg-slate-800 border-slate-700/60 overflow-hidden shadow-lg">
                  <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between space-y-0 border-b border-slate-700/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-primary block">
                          {order.order_number}
                        </span>
                        {isToday(order.order_date) && (
                          <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                            Today
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base font-bold text-white mt-0.5">
                        {order.customers?.company_name || 'Unknown Customer'}
                      </CardTitle>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {order.status === 'Confirmed' ? (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Confirmed</Badge>
                      ) : order.status === 'Partially Delivered' ? (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Partial</Badge>
                      ) : order.status === 'Invoiced' ? (
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 flex items-center gap-1">
                          <Icons.document className="w-3 h-3" /> Invoiced
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                          <Icons.delivered className="w-3 h-3" /> Delivered
                        </Badge>
                      )}
                      {order.tally_invoice_number && (
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-700/40">
                          Inv: {order.tally_invoice_number}
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    {/* Customer Info & Phone Call Action */}
                    <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/40">
                      <div className="flex items-center gap-2">
                        <Icons.phone className="w-4 h-4 text-slate-400" />
                        <span>{order.customers?.phone || 'No phone'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Method:</span>
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0">
                          {order.delivery_method || 'Not Specified'}
                        </Badge>
                      </div>
                      {order.customers?.phone && (
                        <a
                          href={`tel:${order.customers.phone}`}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium flex items-center gap-1 transition-colors"
                        >
                          <Icons.phone className="w-3 h-3" /> Call
                        </a>
                      )}
                    </div>

                    {/* Items to Deliver (Always Visible) */}
                    <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/50 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <span>Items to Deliver</span>
                        <span className="text-slate-400 font-normal">({order.sales_order_lines?.length || 0} items)</span>
                      </div>
                      <div className="divide-y divide-slate-800">
                        {order.sales_order_lines && order.sales_order_lines.length > 0 ? (
                          order.sales_order_lines.map(line => (
                            <div key={line.id} className="py-2 first:pt-1 last:pb-0 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-100 truncate">
                                {line.products?.name || 'Product'}
                              </span>
                              <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded shrink-0">
                                {line.quantity} {line.products?.unit || 'Units'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="py-1 text-xs text-slate-500 italic">No items found</div>
                        )}
                      </div>
                    </div>

                    {/* Delivery Action Buttons */}
                    {(order.status === 'Confirmed' || order.status === 'Partially Delivered') && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/40">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActioning}
                          onClick={() => markPartialDelivery(order)}
                          className="bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-900/60 text-xs font-semibold py-2.5 h-auto"
                        >
                          Partial Delivery
                        </Button>

                        <Button
                          size="sm"
                          disabled={isActioning}
                          onClick={() => markOrderDelivered(order)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 h-auto flex items-center justify-center gap-1"
                        >
                          {isActioning ? (
                            <Icons.refresh className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Icons.delivered className="w-3.5 h-3.5" /> Complete
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
