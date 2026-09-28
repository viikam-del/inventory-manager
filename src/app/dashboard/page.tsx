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
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

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

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // Execute queries sequentially to prevent browser extensions from intercepting and blocking concurrent fetch requests
        const productsRes = await supabase.from('products').select('id, name, current_stock, min_stock_level, unit').eq('is_deleted', false).limit(2000);

        const pendingDeliveriesRes = await supabase.from('sales_orders').select('*', { count: 'exact', head: true }).in('status', ['Confirmed', 'Partially Delivered']).eq('is_deleted', false);

        const pendingTallyRes = await supabase.from('sales_orders').select('*', { count: 'exact', head: true }).in('status', ['Delivered', 'Partially Delivered']).is('tally_invoice_number', null).eq('is_deleted', false);

        const salesRes = await supabase.from('sales_orders').select('total_amount, gst_amount').eq('is_deleted', false).gte('order_date', startOfMonth).limit(1000);

        const paymentsRes = await supabase.from('payments').select('amount').eq('is_deleted', false).gte('payment_date', startOfMonth).limit(1000);

        const purchaseOrdersRes = await supabase.from('purchase_orders').select('delivery_charges, purchase_order_lines(quantity, unit_cost, gst_amount)').eq('is_deleted', false).neq('status', 'Cancelled').gte('order_date', startOfMonth).limit(100);

        const movementsRes = await supabase.from('stock_adjustments').select('*, products(name)').order('created_at', { ascending: false }).limit(6);

        if (productsRes.error) throw productsRes.error;

        // 1. Process Products & Low Stock
        const allProducts = productsRes.data || [];
        const totalProducts = allProducts.length;
        const lowStockItemsData = allProducts
          .filter(p => Number(p.current_stock) <= Number(p.min_stock_level))
          .sort((a, b) => Number(a.current_stock) - Number(b.current_stock));
        const lowStockCount = lowStockItemsData.length;

        // 2. Extract Counts
        const pendingDeliveries = pendingDeliveriesRes.count || 0;
        const pendingTallyInvoices = pendingTallyRes.count || 0;

        // 3. Process Financials
        const salesData = salesRes.data || [];
        const totalSales = salesData.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
        const totalOutputGST = salesData.reduce((acc, curr) => acc + Number(curr.gst_amount || 0), 0);

        const paymentData = paymentsRes.data || [];
        const totalCollections = paymentData.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

        let totalPurchases = 0;
        let totalInputGST = 0;
        const poData = purchaseOrdersRes.data || [];

        poData.forEach((po: any) => {
          totalPurchases += Number(po.delivery_charges || 0);
          if (po.purchase_order_lines) {
            po.purchase_order_lines.forEach((line: any) => {
              totalInputGST += Number(line.gst_amount || 0);
              totalPurchases += (Number(line.quantity || 0) * Number(line.unit_cost || 0)) + Number(line.gst_amount || 0);
            });
          }
        });

        const netGST = totalOutputGST - totalInputGST;
        const grossProfit = totalSales - totalPurchases;

        setStats({
          totalProducts,
          lowStockCount,
          pendingDeliveries,
          pendingTallyInvoices,
          totalSales,
          totalCollections,
          totalOutputGST,
          totalInputGST,
          netGST,
          totalPurchases,
          grossProfit
        });

        setLowStockItems(lowStockItemsData.slice(0, 10));
        setRecentMovements(movementsRes.data || []);

      } catch (err: any) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading operations data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-destructive/20 text-center">
          <CardHeader>
            <Icons.warning className="h-10 w-10 text-destructive mx-auto mb-2" />
            <CardTitle className="text-lg">Dashboard Error</CardTitle>
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
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Operational Overview"
        description="Real-time monitoring of RDS inventory, orders, cash collections, and GST ledger"
        badge={
          <Badge variant="success" className="gap-1 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync
          </Badge>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/purchase-orders/new">
                <Icons.add className="w-3.5 h-3.5 mr-1.5 text-primary" />
                New PO
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sales-orders/new">
                <Icons.add className="w-3.5 h-3.5 mr-1.5" />
                New Sales Order
              </Link>
            </Button>
          </>
        }
      />

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Catalog"
          value={stats.totalProducts}
          icon={<Icons.products className="w-5 h-5 text-blue-500" />}
          iconClassName="bg-blue-500/10 border-blue-500/20"
          description="Active product lines"
        />
        <StatCard
          title="Low Stock"
          value={stats.lowStockCount}
          icon={<Icons.warning className="w-5 h-5 text-amber-500" />}
          iconClassName="bg-amber-500/10 border-amber-500/20"
          description={stats.lowStockCount > 0 ? "Requires reorder" : "Optimal level"}
          trend={stats.lowStockCount > 0 ? { value: stats.lowStockCount, label: "under threshold", isPositive: false } : undefined}
        />
        <StatCard
          title="Deliveries"
          value={stats.pendingDeliveries}
          icon={<Icons.delivery className="w-5 h-5 text-primary" />}
          iconClassName="bg-primary/10 border-primary/20"
          description="Ready for dispatch"
        />
        <StatCard
          title="Pending Invoices"
          value={stats.pendingTallyInvoices}
          icon={<Icons.document className="w-5 h-5 text-rose-500" />}
          iconClassName="bg-rose-500/10 border-rose-500/20"
          description="Awaiting Tally entry"
        />
        <StatCard
          title="Total Sales"
          value={`₹${stats.totalSales.toLocaleString('en-IN')}`}
          icon={<Icons.chart className="w-5 h-5 text-emerald-500" />}
          iconClassName="bg-emerald-500/10 border-emerald-500/20"
          description="Gross invoiced this month"
        />
        <StatCard
          title="Collections"
          value={`₹${stats.totalCollections.toLocaleString('en-IN')}`}
          icon={<Icons.payments className="w-5 h-5 text-cyan-500" />}
          iconClassName="bg-cyan-500/10 border-cyan-500/20"
          description="Collections this month"
        />
      </div>

      {/* Pending Tally Invoice Alert Banner */}
      {stats.pendingTallyInvoices > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Icons.warning className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="font-semibold text-sm text-foreground">
                  Tally Invoicing Pending ({stats.pendingTallyInvoices} orders delivered)
                </p>
                <p className="text-xs text-muted-foreground">
                  Orders have been dispatched and delivered to customers, but Tally invoice numbers are not yet linked to the ledger.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-500/30 text-foreground hover:bg-amber-500/10">
              <Link href="/sales-orders">
                Update Invoices <Icons.forward className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Financial & Tax Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profit & Loss Snapshot */}
        <Card className="flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Icons.trendUp className="w-4 h-4 text-primary" />
                <span>P&L Overview</span>
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">All Time</Badge>
            </div>
            <CardDescription className="text-xs">
              Direct comparison of gross sales revenue against procurement costs
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3 pt-0">
            <div className="flex justify-between items-center py-2.5 border-b border-border/50 text-sm">
              <span className="text-muted-foreground">Total Sales Revenue</span>
              <span className="font-semibold font-mono">₹{stats.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-border/50 text-sm">
              <span className="text-muted-foreground">Total Procurement Costs</span>
              <span className="font-semibold font-mono">₹{stats.totalPurchases.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
          <div className="flex justify-between items-center px-6 py-4 bg-muted/40 rounded-b-xl border-t border-border/60">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Gross Margin</span>
            </div>
            <span className={cn("font-bold text-base font-mono", stats.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              {stats.grossProfit >= 0 ? '+' : ''}₹{stats.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </Card>

        {/* GST Register Snapshot */}
        <Card className="flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Icons.document className="w-4 h-4 text-primary" />
                <span>GST Tax Ledger</span>
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">ITC Balance</Badge>
            </div>
            <CardDescription className="text-xs">
              Output GST collected from sales vs. Input Tax Credit paid on purchases
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3 pt-0">
            <div className="flex justify-between items-center py-2.5 border-b border-border/50 text-sm">
              <div className="flex flex-col">
                <span className="text-foreground font-medium">Output GST (Collected)</span>
                <span className="text-[11px] text-muted-foreground">Total tax billed on customer sales</span>
              </div>
              <span className="font-semibold font-mono">₹{stats.totalOutputGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-border/50 text-sm">
              <div className="flex flex-col">
                <span className="text-foreground font-medium">Input GST (ITC)</span>
                <span className="text-[11px] text-muted-foreground">Tax credit paid on vendor POs</span>
              </div>
              <span className="font-semibold font-mono">₹{stats.totalInputGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
          <div className="flex justify-between items-center px-6 py-4 bg-muted/40 rounded-b-xl border-t border-border/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Net Tax {stats.netGST >= 0 ? 'Liability (Payable)' : 'Credit (Refundable)'}
            </span>
            <span className={cn("font-bold text-base font-mono", stats.netGST > 0 ? 'text-primary' : 'text-emerald-600 dark:text-emerald-400')}>
              ₹{Math.abs(stats.netGST).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {stats.netGST > 0 ? 'Payable' : 'Credit'}
            </span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Alerts */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                <Icons.warning className="w-4 h-4 text-amber-500" /> Low Stock Alerts
              </h2>
              {lowStockItems.length > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                  {lowStockItems.length}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground hover:text-foreground">
              <Link href="/products" className="flex items-center gap-1">
                View All Catalog <Icons.forward className="w-3 h-3" />
              </Link>
            </Button>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/60 border-b border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Product Name</th>
                    <th className="px-5 py-3 text-center">Current Stock</th>
                    <th className="px-5 py-3 text-center">Min Level</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {lowStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Icons.success className="w-6 h-6 text-emerald-500" />
                          <p className="font-medium text-xs">All products are currently above minimum threshold.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    lowStockItems.map(item => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-foreground">{item.name}</td>
                        <td className="px-5 py-3.5 text-center">
                          <Badge variant="destructive" className="font-mono">
                            {item.current_stock} {item.unit || 'units'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-center text-muted-foreground font-mono">
                          {item.min_stock_level}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                            <Link href={`/purchase-orders/new?product_id=${item.id}`}>
                              Reorder
                            </Link>
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
              <Icons.refresh className="w-4 h-4 text-primary" /> Recent Audit Activity
            </h2>
            <Badge variant="secondary" className="text-[10px]">Last 6</Badge>
          </div>

          <Card>
            <CardContent className="p-4 space-y-3">
              {recentMovements.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-xs italic">
                  No recent movements recorded.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentMovements.map((move, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-2.5 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className={cn(
                        "mt-1 w-2 h-2 rounded-full shrink-0",
                        move.adjustment_type === 'In' ? 'bg-emerald-500' : 'bg-rose-500'
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-1">
                          <p className="text-xs font-semibold text-foreground truncate">{move.products?.name || 'Unknown Product'}</p>
                          <Badge variant={move.adjustment_type === 'In' ? 'success' : 'destructive'} className="text-[9px] uppercase px-1 py-0 h-4">
                            {move.adjustment_type}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{move.reason || 'Inventory Adjustment'}</p>
                        <div className="flex justify-between items-center mt-1.5">
                          <span className={cn("text-xs font-bold font-mono", move.adjustment_type === 'In' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
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
              <Button asChild variant="ghost" className="w-full mt-2 text-xs font-medium text-muted-foreground hover:text-foreground h-8">
                <Link href="/receipts" className="flex items-center justify-center gap-1">
                  View Full GRN Inbound Log <Icons.forward className="w-3 h-3" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
