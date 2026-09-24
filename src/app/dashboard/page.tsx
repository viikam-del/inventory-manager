'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockCount: 0,
    pendingDeliveries: 0,
    pendingTallyInvoices: 0,
    totalSales: 0,
    totalCollections: 0,
    totalOutputGST: 0,
    totalInputGST: 0,
    netGST: 0,
    totalPurchases: 0,
    grossProfit: 0
  });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // 1. Core Stats
        const [
          { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
          { count: lowStockCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_deleted', false).lte('current_stock', 'min_stock_level'),
          { count: pendingDeliveries } = await supabase.from('sales_orders').select('*', { count: 'exact', head: true }).in('status', ['Confirmed', 'Partially Delivered']).eq('is_deleted', false),
          { count: pendingTallyInvoices } = await supabase.from('sales_orders').select('*', { count: 'exact', head: true }).in('status', ['Delivered', 'Partially Delivered']).is('tally_invoice_number', null).eq('is_deleted', false),
        ] = await Promise.all([
          supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
          supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_deleted', false).lte('current_stock', 'min_stock_level'),
          supabase.from('sales_orders').select('*', { count: 'exact', head: true }).in('status', ['Confirmed', 'Partially Delivered']).eq('is_deleted', false),
          supabase.from('sales_orders').select('*', { count: 'exact', head: true }).in('status', ['Delivered', 'Partially Delivered']).is('tally_invoice_number', null).eq('is_deleted', false),
        ]);

        // 2. Financial Totals & GST Summary
        const { data: salesData } = await supabase.from('sales_orders').select('total_amount, subtotal, gst_amount').eq('is_deleted', false);
        const totalSales = salesData?.reduce((acc, curr) => acc + Number(curr.total_amount), 0) || 0;
        const totalOutputGST = salesData?.reduce((acc, curr) => acc + Number(curr.gst_amount), 0) || 0;

        const { data: paymentData } = await supabase.from('payments').select('amount').eq('is_deleted', false);
        const totalCollections = paymentData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

        const { data: poData } = await supabase.from('purchase_orders').select('delivery_charges, purchase_order_lines(quantity, unit_cost, gst_amount)').eq('is_deleted', false).neq('status', 'Cancelled');

        let totalPurchases = 0;
        let totalInputGST = 0;

        if (poData) {
          poData.forEach((po: any) => {
            totalPurchases += Number(po.delivery_charges || 0);
            if (po.purchase_order_lines) {
              po.purchase_order_lines.forEach((line: any) => {
                totalInputGST += Number(line.gst_amount || 0);
                totalPurchases += (Number(line.quantity || 0) * Number(line.unit_cost || 0)) + Number(line.gst_amount || 0);
              });
            }
          });
        }

        const netGST = totalOutputGST - totalInputGST;
        const grossProfit = totalSales - totalPurchases;

        setStats({
          totalProducts: totalProducts ?? 0,
          lowStockCount: lowStockCount ?? 0,
          pendingDeliveries: pendingDeliveries ?? 0,
          pendingTallyInvoices: pendingTallyInvoices ?? 0,
          totalSales,
          totalCollections,
          totalOutputGST,
          totalInputGST,
          netGST,
          totalPurchases,
          grossProfit
        });

        // 3. Low Stock Table Data
        const { data: lowStockItemsData } = await supabase
          .from('products')
          .select('id, name, current_stock, min_stock_level')
          .eq('is_deleted', false)
          .lte('current_stock', 'min_stock_level')
          .order('current_stock', { ascending: true });

        setLowStockItems(lowStockItemsData || []);

        // 4. Recent Stock Movements
        const { data: movementsData } = await supabase
          .from('stock_adjustments')
          .select('*, products(name)')
          .order('created_at', { ascending: false })
          .limit(10);

        setRecentMovements(movementsData || []);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <Icons.refresh className="animate-spin h-10 w-10 text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading operations data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-destructive/20 text-center">
          <CardHeader>
            <Icons.warning className="h-10 w-10 text-destructive mx-auto mb-2" />
            <CardTitle className="text-xl">Dashboard Error</CardTitle>
            <CardDescription className="text-destructive font-medium">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()} className="w-full">
              Retry Load
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in slide-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operational Overview</h1>
          <p className="text-muted-foreground mt-1">Real-time monitoring of RDS internal operations</p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/purchase-orders/new">
              <Icons.add className="w-4 h-4 mr-2" />
              New PO
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Total Products"
          value={stats.totalProducts}
          icon={<Icons.products className="w-5 h-5 text-info" />}
          iconClassName="bg-info/10"
        />
        <StatCard
          title="Low Stock"
          value={stats.lowStockCount}
          icon={<Icons.warning className="w-5 h-5 text-warning" />}
          iconClassName="bg-warning/10"
        />
        <StatCard
          title="Pending Deliveries"
          value={stats.pendingDeliveries}
          icon={<Icons.delivery className="w-5 h-5 text-primary" />}
          iconClassName="bg-primary/10"
        />
        <StatCard
          title="Pending Invoices"
          value={stats.pendingTallyInvoices}
          icon={<Icons.document className="w-5 h-5 text-destructive" />}
          iconClassName="bg-destructive/10"
        />
        <StatCard
          title="Total Sales"
          value={`₹${stats.totalSales.toLocaleString('en-IN')}`}
          icon={<Icons.chart className="w-5 h-5 text-success" />}
          iconClassName="bg-success/10"
        />
        <StatCard
          title="Collections"
          value={`₹${stats.totalCollections.toLocaleString('en-IN')}`}
          icon={<Icons.payments className="w-5 h-5 text-info" />}
          iconClassName="bg-info/10"
        />
      </div>

      {/* Pending Tally Invoice Alert */}
      {stats.pendingTallyInvoices > 0 && (
        <Card className="bg-warning/10 border-warning/20">
          <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Icons.warning className="w-6 h-6 text-warning" />
              <div>
                <p className="font-bold text-warning-foreground drop-shadow-sm">Tally Invoicing Pending for {stats.pendingTallyInvoices} Delivered Orders</p>
                <p className="text-sm font-medium text-warning-foreground/80 mt-1">Orders have been fulfilled but Tally invoice numbers are not yet linked.</p>
              </div>
            </div>
            <Button asChild variant="warning" className="shrink-0 font-bold">
              <Link href="/sales-orders">
                Update Waitlist <Icons.forward className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Financial & Tax Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profit & Loss Snapshot */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icons.trendUp className="w-5 h-5 text-primary" /> P&L Overview (All Time)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground font-medium">Total Sales Revenue</span>
              <span className="font-bold">₹{stats.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground font-medium">Total Procurement Costs</span>
              <span className="font-bold">₹{stats.totalPurchases.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
          <div className="flex justify-between items-center p-6 bg-muted/50 rounded-b-xl border-t">
            <span className="text-success font-bold uppercase tracking-wider text-xs">Gross Profit</span>
            <span className={cn("font-black text-lg", stats.grossProfit >= 0 ? 'text-success' : 'text-destructive')}>
              {stats.grossProfit >= 0 ? '+' : ''}₹{stats.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </Card>

        {/* GST Register Snapshot */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icons.document className="w-5 h-5 text-primary" /> GST Register
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <div className="flex flex-col">
                <span className="text-muted-foreground font-medium">Output GST (Collected)</span>
                <span className="text-xs text-muted-foreground/70">Total tax from Sales</span>
              </div>
              <span className="font-bold">₹{stats.totalOutputGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <div className="flex flex-col">
                <span className="text-muted-foreground font-medium">Input GST (ITC)</span>
                <span className="text-xs text-muted-foreground/70">Tax paid on Purchases</span>
              </div>
              <span className="font-bold">₹{stats.totalInputGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
          <div className="flex justify-between items-center p-6 bg-muted/50 rounded-b-xl border-t">
            <span className="text-primary font-bold uppercase tracking-wider text-xs">Net GST Liability</span>
            <span className={cn("font-black text-lg", stats.netGST > 0 ? 'text-primary' : 'text-success')}>
              ₹{Math.abs(stats.netGST).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {stats.netGST > 0 ? 'Payable' : 'Credit'}
            </span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Low Stock Alerts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Icons.warning className="w-5 h-5 text-warning" /> Low Stock Alerts
            </h2>
            <Button variant="link" asChild className="h-auto p-0">
              <Link href="/products">View All Inventory</Link>
            </Button>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted border-b text-muted-foreground font-medium">
                  <tr>
                    <th className="px-6 py-3">Product Name</th>
                    <th className="px-6 py-3 text-center">Current Stock</th>
                    <th className="px-6 py-3 text-center">Min Level</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lowStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground italic">
                        No low stock items. Inventory is healthy.
                      </td>
                    </tr>
                  ) : (
                    lowStockItems.map(item => (
                      <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 font-medium">{item.name}</td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant="destructive">{item.current_stock}</Badge>
                        </td>
                        <td className="px-6 py-4 text-center text-muted-foreground">{item.min_stock_level}</td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/purchase-orders/new?product_id=${item.id}`}>Reorder</Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Recent Stock Movements */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Icons.refresh className="w-5 h-5 text-primary" /> Recent Movements
          </h2>
          <Card>
            <CardContent className="p-4 space-y-4">
              {recentMovements.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground italic text-sm">
                  No recent movements recorded.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentMovements.map((move, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                      <div className={cn(
                        "mt-1 w-2 h-2 rounded-full shrink-0",
                        move.adjustment_type === 'In' ? 'bg-success' : 'bg-destructive'
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-bold truncate">{move.products?.name || 'Unknown Product'}</p>
                          <Badge variant={move.adjustment_type === 'In' ? 'success' : 'destructive'} className="text-[10px] uppercase px-1.5 py-0">
                            {move.adjustment_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{move.reason}</p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs font-bold">
                            {move.adjustment_type === 'In' ? '+' : '-'}{move.quantity}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(move.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button asChild variant="ghost" className="w-full mt-4 text-xs font-medium text-muted-foreground">
                <Link href="/receipts">View Full Audit Log <Icons.forward className="w-3 h-3 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
