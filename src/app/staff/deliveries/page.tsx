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
          customers (company_name, phone, address),
          sales_order_lines (id, quantity, product_id, products (name, unit))
        `)
        .eq('is_deleted', false)
        .in('status', ['Confirmed', 'Partially Delivered', 'Delivered', 'Invoiced'])
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

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

  const handleLogout = () => {
    localStorage.removeItem('rds_staff_user');
    router.push('/staff/login');
  };

  const markOrderDelivered = async (order: DeliveryOrder) => {
    if (!confirm(`Confirm delivery for order ${order.order_number}? Stock levels will be updated.`)) return;

    setActionLoadingId(order.id);
    try {
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

      const { error: updateErr } = await supabase
        .from('sales_orders')
        .update({ status: 'Delivered' })
        .eq('id', order.id);

      if (updateErr) throw updateErr;

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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-16">
      {/* Mobile Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-xs">
            <Icons.delivery className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">Delivery Dispatch</h1>
            <p className="text-xs text-slate-500 font-medium">{user?.name || 'Driver'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDeliveries}
            className="h-9 px-3 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
            title="Refresh Deliveries"
          >
            <Icons.refresh className="w-3.5 h-3.5 mr-1 text-slate-500" /> Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="h-9 text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs"
          >
            <Icons.logout className="w-4 h-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search order # or customer name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          />
        </div>

        {/* Tab Filters */}
        <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              "py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs",
              activeTab === 'pending'
                ? "bg-white text-primary shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Pending / In-Transit
            <Badge className={cn("px-1.5 py-0 text-[10px] font-bold rounded-full", activeTab === 'pending' ? "bg-primary text-white" : "bg-slate-300 text-slate-700")}>
              {pendingOrders.length}
            </Badge>
          </button>

          <button
            onClick={() => setActiveTab('delivered')}
            className={cn(
              "py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs",
              activeTab === 'delivered'
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Completed
            <Badge className={cn("px-1.5 py-0 text-[10px] font-bold rounded-full", activeTab === 'delivered' ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-700")}>
              {completedOrders.length}
            </Badge>
          </button>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Icons.refresh className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-slate-500 text-xs font-medium">Loading delivery dispatches...</p>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Icons.delivery className="w-6 h-6" />
            </div>
            <p className="text-slate-800 font-semibold text-sm">No dispatches found</p>
            <p className="text-slate-500 text-xs mt-1">There are no orders matching this tab or search.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedOrders.map(order => {
              const isActioning = actionLoadingId === order.id;

              return (
                <Card key={order.id} className="bg-white border-slate-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                  <CardHeader className="p-4 pb-3 flex flex-row items-start justify-between space-y-0 border-b border-slate-100 bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-md">
                          {order.order_number}
                        </span>
                        {isToday(order.order_date) && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            Today
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
                        {order.customers?.company_name || 'Unknown Customer'}
                      </CardTitle>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Ordered: {new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-700">₹{Number(order.total_amount).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {order.status === 'Confirmed' ? (
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-medium px-2.5 py-0.5">Confirmed</Badge>
                      ) : order.status === 'Partially Delivered' ? (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-medium px-2.5 py-0.5">Partial</Badge>
                      ) : order.status === 'Invoiced' ? (
                        <Badge className="bg-purple-50 text-purple-700 border-purple-200 font-medium px-2.5 py-0.5 flex items-center gap-1">
                          <Icons.document className="w-3 h-3" /> Invoiced
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium px-2.5 py-0.5 flex items-center gap-1">
                          <Icons.delivered className="w-3 h-3" /> Delivered
                        </Badge>
                      )}
                      {order.tally_invoice_number && (
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Inv: {order.tally_invoice_number}
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3.5">
                    {/* Customer Contact & Actions */}
                    <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <Icons.phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{order.customers?.phone || 'No phone number'}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {order.delivery_method && (
                          <span className="px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded-md text-[11px] font-medium">
                            {order.delivery_method}
                          </span>
                        )}
                        {order.customers?.phone && (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${order.customers.phone}`}
                              className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium flex items-center gap-1 shadow-xs transition-colors text-xs"
                            >
                              <Icons.phone className="w-3.5 h-3.5" /> Call
                            </a>
                            <a
                              href={`https://wa.me/${order.customers.phone.replace(/[^0-9]/g, '')}?text=Hello%20from%20RDS%20Delivery%20regarding%20Order%20${order.order_number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium flex items-center gap-1 shadow-xs transition-colors text-xs"
                              title="WhatsApp Customer"
                            >
                              <Icons.phone className="w-3.5 h-3.5" /> WA
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Items to Deliver */}
                    <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <span>Items to Deliver</span>
                        <span className="text-slate-600 font-semibold">({order.sales_order_lines?.length || 0} items)</span>
                      </div>
                      <div className="divide-y divide-slate-200/60">
                        {order.sales_order_lines && order.sales_order_lines.length > 0 ? (
                          order.sales_order_lines.map(line => (
                            <div key={line.id} className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-slate-800 leading-snug">
                                {line.products?.name || 'Product'}
                              </span>
                              <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md shrink-0">
                                {line.quantity} {line.products?.unit || 'Units'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="py-2 text-xs text-slate-400 italic">No items found</div>
                        )}
                      </div>
                    </div>

                    {/* Delivery Action Buttons */}
                    {(order.status === 'Confirmed' || order.status === 'Partially Delivered') && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActioning}
                          onClick={() => markPartialDelivery(order)}
                          className="bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 text-xs font-semibold py-3 h-auto rounded-xl shadow-xs"
                        >
                          Partial Delivery
                        </Button>

                        <Button
                          size="sm"
                          disabled={isActioning}
                          onClick={() => markOrderDelivered(order)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-3 h-auto flex items-center justify-center gap-1.5 rounded-xl shadow-xs"
                        >
                          {isActioning ? (
                            <Icons.refresh className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Icons.delivered className="w-4 h-4" /> Complete Delivery
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
