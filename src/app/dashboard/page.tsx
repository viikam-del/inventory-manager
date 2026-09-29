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
    // P&L (GST-exclusive)
    billedSalesRevenue: 0,
    cashSalesRevenue: 0,
    totalSales: 0,
    salesFreight: 0,
    billedPurchaseCost: 0,
    cashPurchaseCost: 0,
    totalPurchases: 0,
    purchaseFreight: 0,
    grossProfit: 0,
    // Collections
    totalCollections: 0,
    // GST Ledger (billed lines only)
    totalOutputGST: 0,
    totalInputGST: 0,
    netGST: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [movementFilter, setMovementFilter] = useState<'All' | 'In' | 'Out'>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentMonthName = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // Execute queries sequentially to prevent browser extensions from intercepting and blocking concurrent fetch requests
        const productsRes = await supabase
          .from('products')
          .select('id, name, sku_code, current_stock, min_stock_level, unit')
          .eq('is_deleted', false)
          .limit(2000);

        const pendingDeliveriesRes = await supabase
          .from('sales_orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['Confirmed', 'Partially Delivered'])
          .eq('is_deleted', false);

        const pendingTallyRes = await supabase
          .from('sales_orders')
          .select('*', { count: 'exact', head: true })
          .eq('is_gst', true)
          .in('status', ['Delivered', 'Partially Delivered'])
          .is('tally_invoice_number', null)
          .eq('is_deleted', false);

        const salesRes = await supabase
          .from('sales_orders')
          .select('id, delivery_charges, is_gst, sales_order_lines(quantity, unit_price, gst_amount)')
          .eq('is_deleted', false)
          .in('status', ['Confirmed', 'Partially Delivered', 'Delivered', 'Invoiced'])
          .gte('order_date', startOfMonth)
          .limit(1000);

        const paymentsRes = await supabase
          .from('payments')
          .select('amount')
          .eq('is_deleted', false)
          .gte('payment_date', startOfMonth)
          .limit(1000);

        const purchaseOrdersRes = await supabase
          .from('purchase_orders')
          .select('delivery_charges, purchase_order_lines(quantity, unit_cost, gst_amount, is_billed)')
          .eq('is_deleted', false)
          .neq('status', 'Cancelled')
          .gte('order_date', startOfMonth)
          .limit(100);

        const movementsRes = await supabase
          .from('stock_adjustments')
          .select('*, products(name, sku_code, unit)')
          .order('created_at', { ascending: false })
          .limit(30);

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

        // 3. Process Financials — P&L is entirely GST-exclusive
        const salesData = salesRes.data || [];

        let billedSalesRevenue = 0;
        let cashSalesRevenue = 0;
        let salesFreight = 0;
        let totalOutputGST = 0;

        salesData.forEach((so: any) => {
          salesFreight += Number(so.delivery_charges || 0);
          const isBilledOrder = so.is_gst === true;

          if (so.sales_order_lines) {
            so.sales_order_lines.forEach((line: any) => {
              const lineRevenue = Number(line.quantity || 0) * Number(line.unit_price || 0);
              if (isBilledOrder) {
                billedSalesRevenue += lineRevenue;
                totalOutputGST += Number(line.gst_amount || 0);
              } else {
                cashSalesRevenue += lineRevenue;
              }
            });
          }
        });

        const totalSales = billedSalesRevenue + cashSalesRevenue + salesFreight;

        const paymentData = paymentsRes.data || [];
        const totalCollections = paymentData.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

        let billedPurchaseCost = 0;
        let cashPurchaseCost = 0;
        let purchaseFreight = 0;
        let totalInputGST = 0;
        const poData = purchaseOrdersRes.data || [];

        poData.forEach((po: any) => {
          purchaseFreight += Number(po.delivery_charges || 0);
          if (po.purchase_order_lines) {
            po.purchase_order_lines.forEach((line: any) => {
              const lineCost = Number(line.quantity || 0) * Number(line.unit_cost || 0);
              if (line.is_billed) {
                billedPurchaseCost += lineCost;
                totalInputGST += Number(line.gst_amount || 0);
              } else {
                cashPurchaseCost += lineCost;
              }
            });
          }
        });

        const totalPurchases = billedPurchaseCost + cashPurchaseCost + purchaseFreight;
        const netGST = totalOutputGST - totalInputGST;
        const grossProfit = totalSales - totalPurchases;

        setStats({
          totalProducts,
          lowStockCount,
          pendingDeliveries,
          pendingTallyInvoices,
          billedSalesRevenue,
          cashSalesRevenue,
          totalSales,
          salesFreight,
          billedPurchaseCost,
          cashPurchaseCost,
          totalPurchases,
          purchaseFreight,
          grossProfit,
          totalCollections,
          totalOutputGST,
          totalInputGST,
          netGST,
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

  const filteredMovements = recentMovements.filter((m) => {
    if (movementFilter === 'All') return true;
    return m.adjustment_type === movementFilter;
  });

  const grossMarginPct = stats.totalSales > 0
    ? ((stats.grossProfit / stats.totalSales) * 100).toFixed(1)
    : '0.0';

  return (
    <PageContainer>
      {/* Page Header */}
      <PageHeader
        title="Operational Overview"
        description="Real-time monitoring of RDS inventory, orders, cash collections, and GST ledger"
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="success" className="gap-1 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </Badge>
            <Badge variant="outline" className="text-[10px] font-medium hidden sm:inline-flex">
              {currentMonthName}
            </Badge>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/receipts/new">
                <Icons.in className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                Receive GRN
              </Link>
            </Button>
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
          </div>
        }
      />

      {/* Tier 1: Operational Health Strip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Icons.inventory className="w-3.5 h-3.5 text-primary" /> Operational Status
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Catalog"
            value={stats.totalProducts}
            icon={<Icons.products className="w-5 h-5 text-blue-500" />}
            iconClassName="bg-blue-500/10 border-blue-500/20"
            description="Active product lines in catalog"
          />
          <StatCard
            title="Low Stock Alerts"
            value={stats.lowStockCount}
            icon={<Icons.warning className="w-5 h-5 text-amber-500" />}
            iconClassName={cn(
              "border-amber-500/20",
              stats.lowStockCount > 0 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse" : "bg-muted/50"
            )}
            description={stats.lowStockCount > 0 ? "Items below min threshold" : "All levels healthy"}
            trend={stats.lowStockCount > 0 ? { value: stats.lowStockCount, label: "below minimum", isPositive: false } : undefined}
          />
          <StatCard
            title="Ready for Dispatch"
            value={stats.pendingDeliveries}
            icon={<Icons.delivery className="w-5 h-5 text-primary" />}
            iconClassName="bg-primary/10 border-primary/20"
            description="Confirmed & in progress"
          />
          <StatCard
            title="Pending Invoices"
            value={stats.pendingTallyInvoices}
            icon={<Icons.document className="w-5 h-5 text-rose-500" />}
            iconClassName="bg-rose-500/10 border-rose-500/20"
            description={stats.pendingTallyInvoices > 0 ? "Delivered awaiting Tally #" : "All ledger synced"}
            trend={stats.pendingTallyInvoices > 0 ? { value: stats.pendingTallyInvoices, label: "unlinked", isPositive: false } : undefined}
          />
        </div>
      </div>

      {/* Tier 2: Monthly Financial Highlights Strip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Icons.chart className="w-3.5 h-3.5 text-emerald-500" /> Monthly Financial Performance ({currentMonthName})
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Sales Revenue"
            value={`₹${Math.round(stats.totalSales).toLocaleString('en-IN')}`}
            icon={<Icons.sales className="w-5 h-5 text-emerald-500" />}
            iconClassName="bg-emerald-500/10 border-emerald-500/20"
            description={`Billed: ₹${Math.round(stats.billedSalesRevenue).toLocaleString('en-IN')} • Cash: ₹${Math.round(stats.cashSalesRevenue).toLocaleString('en-IN')}`}
          />
          <StatCard
            title="Cash Collections"
            value={`₹${Math.round(stats.totalCollections).toLocaleString('en-IN')}`}
            icon={<Icons.payments className="w-5 h-5 text-cyan-500" />}
            iconClassName="bg-cyan-500/10 border-cyan-500/20"
            description="Realized payments this month"
          />
          <StatCard
            title="Net Procurement"
            value={`₹${Math.round(stats.totalPurchases).toLocaleString('en-IN')}`}
            icon={<Icons.purchase className="w-5 h-5 text-indigo-500" />}
            iconClassName="bg-indigo-500/10 border-indigo-500/20"
            description={`Billed: ₹${Math.round(stats.billedPurchaseCost).toLocaleString('en-IN')} • Cash: ₹${Math.round(stats.cashPurchaseCost).toLocaleString('en-IN')}`}
          />
          <StatCard
            title="Gross Margin"
            value={`${stats.grossProfit >= 0 ? '+' : ''}₹${Math.round(stats.grossProfit).toLocaleString('en-IN')}`}
            icon={
              stats.grossProfit >= 0 ? (
                <Icons.trendUp className="w-5 h-5 text-emerald-500" />
              ) : (
                <Icons.trendDown className="w-5 h-5 text-rose-500" />
              )
            }
            iconClassName={stats.grossProfit >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}
            description={`${grossMarginPct}% operating margin`}
            trend={{
              value: `${grossMarginPct}%`,
              label: "margin",
              isPositive: stats.grossProfit >= 0
            }}
          />
        </div>
      </div>

      {/* Pending Tally Invoice Alert Banner */}
      {stats.pendingTallyInvoices > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 overflow-hidden shadow-xs">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/30">
                <Icons.warning className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <span>Tally Invoicing Pending</span>
                  <Badge variant="warning" className="h-5 px-1.5 text-[10px]">
                    {stats.pendingTallyInvoices} Orders
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Orders have been dispatched and delivered to customers, but Tally invoice numbers have not yet been assigned.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-500/30 text-foreground hover:bg-amber-500/15">
              <Link href="/sales-orders">
                Update Invoices <Icons.forward className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Balanced Financial & Tax Ledger Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Profit & Loss Statement */}
        <Card className="flex flex-col justify-between overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Icons.trendUp className="w-4 h-4 text-emerald-500" />
                <span>Profit & Loss Overview</span>
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">{currentMonthName}</Badge>
            </div>
            <CardDescription className="text-xs">
              GST-exclusive operating revenue & procurement breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4 pt-4">
            {/* Revenue Inflow Sub-Panel */}
            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Icons.in className="w-3.5 h-3.5" /> Revenue Inflow
                </span>
                <span className="font-mono font-bold text-xs text-foreground">
                  ₹{stats.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="pl-1">Billed Sales (GST Invoiced)</span>
                  <span className="font-mono font-medium text-foreground">₹{stats.billedSalesRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="pl-1">Cash Sales (Non-GST Direct)</span>
                  <span className="font-mono font-medium text-foreground">₹{stats.cashSalesRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="pl-1">Freight / Delivery Invoiced</span>
                  <span className="font-mono font-medium text-foreground">₹{stats.salesFreight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Procurement Outflow Sub-Panel */}
            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Icons.out className="w-3.5 h-3.5" /> Procurement Outflow
                </span>
                <span className="font-mono font-bold text-xs text-foreground">
                  ₹{stats.totalPurchases.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="pl-1">Billed Procurement (GST Orders)</span>
                  <span className="font-mono font-medium text-foreground">₹{stats.billedPurchaseCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="pl-1">Cash Purchases (Non-GST)</span>
                  <span className="font-mono font-medium text-foreground">₹{stats.cashPurchaseCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="pl-1">Inward Freight / Shipping</span>
                  <span className="font-mono font-medium text-foreground">₹{stats.purchaseFreight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>

          {/* Balanced Footer */}
          <div className="flex justify-between items-center px-5 py-3.5 bg-muted/40 border-t border-border/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Operating Gross Margin</span>
              <Badge variant={stats.grossProfit >= 0 ? "success" : "destructive"} className="text-[10px] font-mono">
                {grossMarginPct}%
              </Badge>
            </div>
            <span className={cn(
              "font-bold text-base font-mono",
              stats.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            )}>
              {stats.grossProfit >= 0 ? '+' : ''}₹{stats.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </Card>

        {/* GST Tax Ledger */}
        <Card className="flex flex-col justify-between overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Icons.document className="w-4 h-4 text-primary" />
                <span>GST Tax Ledger</span>
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">{currentMonthName}</Badge>
            </div>
            <CardDescription className="text-xs">
              Input Tax Credit (ITC) vs Output GST liability on billed orders
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4 pt-4">
            {/* Taxable Turnover Base Panel */}
            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Icons.chart className="w-3.5 h-3.5" /> Taxable Turnover Base
                </span>
                <span className="font-mono font-bold text-xs text-muted-foreground">
                  Billed Activity
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="pl-1">Taxable Sales Turnover (Output Base)</span>
                  <span className="font-mono font-medium text-foreground">₹{stats.billedSalesRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="pl-1">Taxable Procurement (Input Base)</span>
                  <span className="font-mono font-medium text-foreground">₹{stats.billedPurchaseCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* GST Tax Breakdown Panel */}
            <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Icons.receipts className="w-3.5 h-3.5" /> Tax Breakdown
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  CGST + SGST / IGST
                </span>
              </div>
              <div className="space-y-2.5 text-xs pt-1">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">Output GST (Collected from Customers)</span>
                    <span className="text-[10px] text-muted-foreground">Gross tax liability generated on billed sales</span>
                  </div>
                  <span className="font-semibold font-mono text-sm text-foreground">
                    ₹{stats.totalOutputGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-border/30">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">Input GST (Paid to Suppliers / ITC)</span>
                    <span className="text-[10px] text-muted-foreground">Available Input Tax Credit on billed POs</span>
                  </div>
                  <span className="font-semibold font-mono text-sm text-foreground">
                    ₹{stats.totalInputGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>

          {/* Balanced Footer */}
          <div className="flex justify-between items-center px-5 py-3.5 bg-muted/40 border-t border-border/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Net Tax Position</span>
              <Badge
                variant={stats.netGST > 0 ? "warning" : "success"}
                className="text-[10px] font-mono"
              >
                {stats.netGST > 0 ? 'Payable' : stats.netGST < 0 ? 'ITC Refundable' : 'Balanced'}
              </Badge>
            </div>
            <span className={cn(
              "font-bold text-base font-mono",
              stats.netGST > 0 ? 'text-primary' : 'text-emerald-600 dark:text-emerald-400'
            )}>
              ₹{Math.abs(stats.netGST).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {stats.netGST > 0 ? 'Liability' : 'Credit'}
            </span>
          </div>
        </Card>
      </div>

      {/* Operational Feeds & Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Low Stock Alerts (2 Columns) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                <Icons.warning className="w-4 h-4 text-amber-500" /> Low Stock Inventory Alerts
              </h2>
              {lowStockItems.length > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                  {lowStockItems.length} Urgent
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
                    <th className="px-4 py-3 text-center">Current Stock</th>
                    <th className="px-4 py-3 text-center">Min Level</th>
                    <th className="px-4 py-3 text-center">Deficit</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {lowStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Icons.success className="w-7 h-7 text-emerald-500" />
                          <p className="font-semibold text-foreground text-sm">Optimal Inventory Health</p>
                          <p className="text-xs text-muted-foreground">All active catalog products are currently above their minimum reorder thresholds.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    lowStockItems.map((item) => {
                      const deficit = Math.max(0, Number(item.min_stock_level) - Number(item.current_stock));
                      return (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <Link href={`/products/${item.id}`} className="font-medium text-foreground hover:text-primary hover:underline block truncate max-w-[220px]">
                              {item.name}
                            </Link>
                            {item.sku_code && (
                              <span className="text-[10px] text-muted-foreground font-mono block">
                                SKU: {item.sku_code}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge variant="destructive" className="font-mono text-xs">
                              {item.current_stock} {item.unit || 'units'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-center text-muted-foreground font-mono">
                            {item.min_stock_level} {item.unit || 'units'}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge variant="outline" className="font-mono text-[10px] text-rose-600 dark:text-rose-400 border-rose-500/30 bg-rose-500/5">
                              -{deficit} {item.unit || 'units'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Button variant="outline" size="sm" asChild className="h-7 text-xs gap-1 hover:border-primary">
                              <Link href={`/purchase-orders/new?product_id=${item.id}`}>
                                <Icons.purchase className="w-3 h-3 text-primary" />
                                Reorder
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Recent Stock Movements & Audit Feed (1 Column) */}
        <div className="space-y-3 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2 whitespace-nowrap">
              <Icons.refresh className="w-4 h-4 text-primary shrink-0" /> Audit Activity
            </h2>
            <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg border border-border/60 shrink-0">
              {(['All', 'In', 'Out'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setMovementFilter(filter)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] sm:text-[11px] font-medium rounded-md transition-colors",
                    movementFilter === filter
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {filter === 'All' ? 'All' : filter === 'In' ? 'In (+)' : 'Out (-)'}
                </button>
              ))}
            </div>
          </div>

          <Card className="flex-1 flex flex-col">
            <CardContent className="p-0 flex flex-col">
              <div className="overflow-y-auto p-3.5 space-y-2.5 max-h-[460px]">
                {filteredMovements.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-xs italic">
                    No movements found matching the &apos;{movementFilter}&apos; filter.
                  </div>
                ) : (
                  filteredMovements.map((move, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className={cn(
                        "mt-1 w-2 h-2 rounded-full shrink-0",
                        move.adjustment_type === 'In' ? 'bg-emerald-500' : 'bg-rose-500'
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-1">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {move.products?.name || 'Inventory Item'}
                          </p>
                          <Badge
                            variant={move.adjustment_type === 'In' ? 'success' : 'destructive'}
                            className="text-[9px] uppercase px-1 py-0 h-4 font-mono shrink-0"
                          >
                            {move.adjustment_type}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {move.reason || 'Manual Adjustment'}
                        </p>
                        <div className="flex justify-between items-center mt-1.5 pt-1 border-t border-border/30">
                          <span className={cn(
                            "text-xs font-bold font-mono",
                            move.adjustment_type === 'In' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          )}>
                            {move.adjustment_type === 'In' ? '+' : '-'}{move.quantity} {move.products?.unit || ''}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(move.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
