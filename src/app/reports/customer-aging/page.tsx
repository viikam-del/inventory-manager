'use client';

import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Modal } from '@/components/ui/modal';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';
import { cn } from '@/lib/utils';

interface CustomerRecord {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  whatsapp: string | null;
  credit_limit: number | null;
  default_due_days: number | null;
  opening_balance: number | null;
}

interface SalesOrderRecord {
  id: string;
  customer_id: string;
  order_number?: string;
  so_number?: string;
  order_date: string;
  total_amount: number;
  gst_amount?: number;
  is_gst_order?: boolean;
  status: string;
}

interface PaymentRecord {
  id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
}

interface UnpaidInvoice {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  dueDate: string;
  daysOverdue: number;
  totalAmount: number;
  unpaidAmount: number;
  bracket: 'current' | 'due' | 'overdue' | 'critical';
}

interface CustomerAgingSummary {
  customer: CustomerRecord;
  totalOutstanding: number;
  creditLimit: number;
  isExceeded: boolean;
  creditUtilizationPct: number;
  current_0_15: number;
  due_16_30: number;
  overdue_31_60: number;
  critical_60_plus: number;
  maxDaysOverdue: number;
  unpaidInvoices: UnpaidInvoice[];
}

export default function CustomerAgingReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agingData, setAgingData] = useState<CustomerAgingSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBracket, setSelectedBracket] = useState<string>('all');
  const [sortField, setSortField] = useState<'outstanding' | 'company' | 'overdue' | 'credit'>('outstanding');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAgingSummary | null>(null);

  useEffect(() => {
    loadAgingData();
  }, []);

  async function loadAgingData() {
    setLoading(true);
    setError(null);
    try {
      const [custRes, salesRes, payRes] = await Promise.all([
        supabase.from('customers').select('*').eq('is_deleted', false),
        supabase.from('sales_orders').select('*').eq('is_deleted', false),
        supabase.from('payments').select('*').eq('is_deleted', false),
      ]);

      if (custRes.error) throw custRes.error;
      if (salesRes.error) throw salesRes.error;
      if (payRes.error) throw payRes.error;

      const customers: CustomerRecord[] = custRes.data || [];
      const salesOrders: SalesOrderRecord[] = salesRes.data || [];
      const payments: PaymentRecord[] = payRes.data || [];

      const today = new Date().getTime();

      const summaries: CustomerAgingSummary[] = customers.map((cust) => {
        const custOrders = salesOrders
          .filter((so) => so.customer_id === cust.id)
          .sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime());

        const custPayments = payments.filter((p) => p.customer_id === cust.id);

        const totalPayments = custPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
        let paymentsRemaining = totalPayments;

        // Opening balance deduction first
        const openingBal = Number(cust.opening_balance || 0);
        let unpaidOpeningBal = 0;
        if (openingBal > 0) {
          if (paymentsRemaining >= openingBal) {
            paymentsRemaining -= openingBal;
          } else {
            unpaidOpeningBal = openingBal - paymentsRemaining;
            paymentsRemaining = 0;
          }
        }

        // FIFO allocation of remaining payments across chronological orders
        const unpaidInvoices: UnpaidInvoice[] = [];
        let current_0_15 = 0;
        let due_16_30 = 0;
        let overdue_31_60 = 0;
        let critical_60_plus = unpaidOpeningBal; // unpaid opening balance is treated as critical debt

        const defaultDueDays = cust.default_due_days && cust.default_due_days > 0 ? cust.default_due_days : 7;

        for (const order of custOrders) {
          const invTotal = Number(order.total_amount || 0) + Number(order.gst_amount || 0);
          if (paymentsRemaining >= invTotal) {
            paymentsRemaining -= invTotal;
          } else {
            const unpaid = invTotal - paymentsRemaining;
            paymentsRemaining = 0;

            const orderDateObj = new Date(order.order_date);
            const dueDateObj = new Date(orderDateObj);
            dueDateObj.setDate(dueDateObj.getDate() + defaultDueDays);

            const daysOverdue = Math.max(0, Math.floor((today - dueDateObj.getTime()) / (1000 * 60 * 60 * 24)));

            let bracket: 'current' | 'due' | 'overdue' | 'critical' = 'current';
            if (daysOverdue > 60) {
              bracket = 'critical';
              critical_60_plus += unpaid;
            } else if (daysOverdue > 30) {
              bracket = 'overdue';
              overdue_31_60 += unpaid;
            } else if (daysOverdue > 15) {
              bracket = 'due';
              due_16_30 += unpaid;
            } else {
              bracket = 'current';
              current_0_15 += unpaid;
            }

            unpaidInvoices.push({
              orderId: order.id,
              orderNumber: order.order_number || order.so_number || `SO-${order.id.slice(0, 6)}`,
              orderDate: order.order_date,
              dueDate: dueDateObj.toISOString().split('T')[0],
              daysOverdue,
              totalAmount: invTotal,
              unpaidAmount: unpaid,
              bracket,
            });
          }
        }

        const totalOutstanding = current_0_15 + due_16_30 + overdue_31_60 + critical_60_plus;
        const creditLimit = Number(cust.credit_limit || 0);
        const isExceeded = creditLimit > 0 && totalOutstanding > creditLimit;
        const creditUtilizationPct = creditLimit > 0 ? Math.round((totalOutstanding / creditLimit) * 100) : 0;
        const maxDaysOverdue = unpaidInvoices.reduce((max, inv) => Math.max(max, inv.daysOverdue), unpaidOpeningBal > 0 ? 61 : 0);

        return {
          customer: cust,
          totalOutstanding,
          creditLimit,
          isExceeded,
          creditUtilizationPct,
          current_0_15,
          due_16_30,
          overdue_31_60,
          critical_60_plus,
          maxDaysOverdue,
          unpaidInvoices,
        };
      });

      // Filter only customers with active outstanding or credit limit set
      setAgingData(summaries.filter((s) => s.totalOutstanding > 0 || s.creditLimit > 0));
    } catch (err: any) {
      console.error('Failed to load aging data:', err);
      setError(err.message || 'Failed to calculate accounts receivable aging.');
    } finally {
      setLoading(false);
    }
  }

  // Aggregate Metrics for Top KPI Cards
  const kpiMetrics = useMemo(() => {
    let totalReceivables = 0;
    let atRiskCapital = 0; // 31+ days overdue (overdue + critical)
    let exceededCount = 0;
    let weightedDaysNumerator = 0;

    agingData.forEach((row) => {
      totalReceivables += row.totalOutstanding;
      atRiskCapital += row.overdue_31_60 + row.critical_60_plus;
      if (row.isExceeded) exceededCount++;
      weightedDaysNumerator += row.totalOutstanding * row.maxDaysOverdue;
    });

    const weightedDSO = totalReceivables > 0 ? Math.round(weightedDaysNumerator / totalReceivables) : 0;

    return {
      totalReceivables,
      atRiskCapital,
      weightedDSO,
      exceededCount,
    };
  }, [agingData]);

  // Filtered & Sorted Records
  const filteredData = useMemo(() => {
    return agingData
      .filter((item) => {
        const matchesSearch =
          item.customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.customer.contact_person && item.customer.contact_person.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (item.customer.phone && item.customer.phone.includes(searchTerm)) ||
          (item.customer.whatsapp && item.customer.whatsapp.includes(searchTerm));

        if (!matchesSearch) return false;

        if (selectedBracket === 'current') return item.current_0_15 > 0;
        if (selectedBracket === 'due') return item.due_16_30 > 0;
        if (selectedBracket === 'overdue') return item.overdue_31_60 > 0;
        if (selectedBracket === 'critical') return item.critical_60_plus > 0;
        if (selectedBracket === 'exceeded') return item.isExceeded;

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'outstanding') {
          diff = a.totalOutstanding - b.totalOutstanding;
        } else if (sortField === 'company') {
          diff = a.customer.company_name.localeCompare(b.customer.company_name);
        } else if (sortField === 'overdue') {
          diff = a.maxDaysOverdue - b.maxDaysOverdue;
        } else if (sortField === 'credit') {
          diff = a.creditUtilizationPct - b.creditUtilizationPct;
        }
        return sortDirection === 'desc' ? -diff : diff;
      });
  }, [agingData, searchTerm, selectedBracket, sortField, sortDirection]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Customer',
      'Contact Person',
      'Phone',
      'Credit Limit (₹)',
      'Total Outstanding (₹)',
      '0-15 Days (Current)',
      '16-30 Days (Due)',
      '31-60 Days (Overdue)',
      '60+ Days (Critical)',
      'Credit Exceeded?',
      'Utilization %',
    ];

    const rows = filteredData.map((row) => [
      `"${row.customer.company_name}"`,
      `"${row.customer.contact_person || ''}"`,
      `"${row.customer.phone || row.customer.whatsapp || ''}"`,
      row.creditLimit,
      row.totalOutstanding,
      row.current_0_15,
      row.due_16_30,
      row.overdue_31_60,
      row.critical_60_plus,
      row.isExceeded ? 'YES' : 'NO',
      `${row.creditUtilizationPct}%`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AR_Customer_Aging_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp reminder generator
  const sendWhatsAppReminder = (summary: CustomerAgingSummary) => {
    const phone = summary.customer.whatsapp || summary.customer.phone;
    if (!phone) {
      alert('No phone or WhatsApp number is configured for this customer.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const recipient = cleanPhone.startsWith('91') && cleanPhone.length === 12 ? cleanPhone : `91${cleanPhone}`;
    const name = summary.customer.contact_person || summary.customer.company_name;
    const amountStr = summary.totalOutstanding.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

    let message = `Dear ${name},\n\nThis is a friendly reminder regarding your outstanding account balance of *${amountStr}* with Rainbow Digital Solutions.\n\n`;

    if (summary.critical_60_plus > 0 || summary.overdue_31_60 > 0) {
      message += `Attention: ₹${(summary.critical_60_plus + summary.overdue_31_60).toLocaleString('en-IN')} is significantly overdue (>30 days).\n\n`;
    }

    message += `Please arrange for settlement at your earliest convenience. If already paid, please ignore this notice.\n\nThank you for your business!`;

    const url = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });
  };

  return (
    <PageContainer>
      <PageHeader
        title="AR Customer Aging & Credit Ledger"
        description="Accounts Receivable aging analysis with dynamic risk profiling and collection follow-ups."
        badge={
          <Badge variant="outline" className="border-primary/30 text-primary">
            v10 Enterprise
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredData.length === 0}
              className="gap-1.5"
            >
              <Icons.download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAgingData}
              className="gap-1.5"
            >
              <Icons.refresh className={cn('w-4 h-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Top 4 KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Receivables"
          value={formatCurrency(kpiMetrics.totalReceivables)}
          icon={<Icons.dollar className="w-5 h-5 text-primary" />}
          description="Total balance owed by customers"
        />

        <StatCard
          title="At-Risk Capital"
          value={formatCurrency(kpiMetrics.atRiskCapital)}
          icon={<Icons.shieldAlert className="w-5 h-5 text-destructive" />}
          description="Aged over 30 days overdue"
          iconClassName="bg-destructive/10 border-destructive/20"
        />

        <StatCard
          title="Weighted Overdue Age"
          value={`${kpiMetrics.weightedDSO} Days`}
          icon={<Icons.calendar className="w-5 h-5 text-amber-500" />}
          description="Weighted average age of credit"
          iconClassName="bg-amber-500/10 border-amber-500/20"
        />

        <StatCard
          title="Credit Breaches"
          value={`${kpiMetrics.exceededCount} Customers`}
          icon={<Icons.warning className="w-5 h-5 text-destructive" />}
          description="Exceeding configured credit limits"
          iconClassName="bg-destructive/10 border-destructive/20"
        />
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-4 shadow-2xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by company, contact person, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Icons.close className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">Sort By:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-primary"
            >
              <option value="outstanding">Outstanding Balance</option>
              <option value="company">Company Name</option>
              <option value="overdue">Max Days Overdue</option>
              <option value="credit">Credit Utilization</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              className="h-8 px-2 text-xs"
            >
              {sortDirection === 'asc' ? (
                <Icons.trendUp className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Icons.trendDown className="w-3.5 h-3.5 text-primary" />
              )}
            </Button>
          </div>
        </div>

        {/* Risk / Aging Bracket Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-border pt-3">
          {[
            { id: 'all', label: 'All Accounts', count: agingData.length },
            {
              id: 'current',
              label: 'Current (0-15d)',
              count: agingData.filter((i) => i.current_0_15 > 0).length,
              color: 'text-emerald-600',
            },
            {
              id: 'due',
              label: 'Due (16-30d)',
              count: agingData.filter((i) => i.due_16_30 > 0).length,
              color: 'text-blue-600',
            },
            {
              id: 'overdue',
              label: 'Overdue (31-60d)',
              count: agingData.filter((i) => i.overdue_31_60 > 0).length,
              color: 'text-amber-600',
            },
            {
              id: 'critical',
              label: 'Critical (60+d)',
              count: agingData.filter((i) => i.critical_60_plus > 0).length,
              color: 'text-red-600',
            },
            {
              id: 'exceeded',
              label: 'Credit Exceeded',
              count: agingData.filter((i) => i.isExceeded).length,
              color: 'text-rose-600 font-bold',
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedBracket(tab.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5',
                selectedBracket === tab.id
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              <span className={selectedBracket !== tab.id ? tab.color : ''}>{tab.label}</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                  selectedBracket === tab.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background/80 text-foreground'
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Aging Ledger Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-3">
              <Icons.refresh className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm">Calculating accounts receivable aging schedules...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-destructive space-y-2">
              <Icons.warning className="w-8 h-8 mx-auto" />
              <p className="text-sm font-medium">{error}</p>
              <Button variant="outline" size="sm" onClick={loadAgingData}>
                Retry
              </Button>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <Icons.success className="w-10 h-10 mx-auto text-emerald-500 opacity-80" />
              <p className="text-base font-semibold text-foreground">No matching accounts found</p>
              <p className="text-xs text-muted-foreground">All customer accounts in this bracket are cleared or settle on schedule.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                    <th className="py-3 px-4">Customer Account</th>
                    <th className="py-3 px-4">Credit Health</th>
                    <th className="py-3 px-4 text-right">Total Due</th>
                    <th className="py-3 px-3 text-right">Current (0-15d)</th>
                    <th className="py-3 px-3 text-right">Due (16-30d)</th>
                    <th className="py-3 px-3 text-right">Overdue (31-60d)</th>
                    <th className="py-3 px-3 text-right">Critical (60+d)</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredData.map((row) => (
                    <tr
                      key={row.customer.id}
                      className={cn(
                        'hover:bg-muted/30 transition-colors',
                        row.isExceeded && 'bg-destructive/[0.02]'
                      )}
                    >
                      {/* Customer Details */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <Link
                            href={`/customers/${row.customer.id}`}
                            className="font-semibold text-foreground hover:text-primary hover:underline flex items-center gap-1.5"
                          >
                            {row.customer.company_name}
                            <Icons.external className="w-3 h-3 opacity-40" />
                          </Link>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            {row.customer.contact_person && (
                              <span>{row.customer.contact_person}</span>
                            )}
                            {(row.customer.phone || row.customer.whatsapp) && (
                              <span>• {row.customer.phone || row.customer.whatsapp}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Credit Health / Utilization */}
                      <td className="py-3 px-4 min-w-[140px]">
                        {row.creditLimit > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono text-muted-foreground">
                                Cap: {formatCurrency(row.creditLimit)}
                              </span>
                              <span
                                className={cn(
                                  'font-bold text-[10px] px-1.5 py-0.2 rounded',
                                  row.isExceeded
                                    ? 'bg-destructive/15 text-destructive font-bold'
                                    : row.creditUtilizationPct > 80
                                    ? 'bg-amber-500/15 text-amber-600'
                                    : 'bg-emerald-500/15 text-emerald-600'
                                )}
                              >
                                {row.creditUtilizationPct}%
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className={cn(
                                  'h-full transition-all',
                                  row.isExceeded
                                    ? 'bg-destructive'
                                    : row.creditUtilizationPct > 80
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                )}
                                style={{ width: `${Math.min(100, row.creditUtilizationPct)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px] italic">No credit limit</span>
                        )}
                      </td>

                      {/* Total Due */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-sm text-foreground">
                          {formatCurrency(row.totalOutstanding)}
                        </span>
                        {row.maxDaysOverdue > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            Max {row.maxDaysOverdue}d overdue
                          </div>
                        )}
                      </td>

                      {/* Current (0-15) */}
                      <td className="py-3 px-3 text-right">
                        {row.current_0_15 > 0 ? (
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(row.current_0_15)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Due (16-30) */}
                      <td className="py-3 px-3 text-right">
                        {row.due_16_30 > 0 ? (
                          <span className="font-medium text-blue-600 dark:text-blue-400">
                            {formatCurrency(row.due_16_30)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Overdue (31-60) */}
                      <td className="py-3 px-3 text-right">
                        {row.overdue_31_60 > 0 ? (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {formatCurrency(row.overdue_31_60)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Critical (60+) */}
                      <td className="py-3 px-3 text-right">
                        {row.critical_60_plus > 0 ? (
                          <span className="font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(row.critical_60_plus)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            title="Send WhatsApp Payment Notice"
                            onClick={() => sendWhatsAppReminder(row)}
                          >
                            <Icons.share className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-[11px]"
                            onClick={() => setSelectedCustomer(row)}
                          >
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Unpaid Invoices Drill-Down Modal */}
      {selectedCustomer && (
        <Modal
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          title={`Aging Breakdown: ${selectedCustomer.customer.company_name}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* Customer Summary Cards inside Modal */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/30 p-3 rounded-lg border border-border text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Outstanding</span>
                <span className="font-bold text-sm text-foreground">
                  {formatCurrency(selectedCustomer.totalOutstanding)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Credit Limit</span>
                <span className="font-semibold text-foreground">
                  {selectedCustomer.creditLimit > 0
                    ? formatCurrency(selectedCustomer.creditLimit)
                    : 'Unlimited'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Default Due Period</span>
                <span className="font-semibold text-foreground">
                  {selectedCustomer.customer.default_due_days || 7} Days
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Risk State</span>
                <span
                  className={cn(
                    'font-bold text-[11px]',
                    selectedCustomer.isExceeded
                      ? 'text-destructive'
                      : selectedCustomer.critical_60_plus > 0
                      ? 'text-red-500'
                      : 'text-emerald-600'
                  )}
                >
                  {selectedCustomer.isExceeded
                    ? 'Limit Exceeded'
                    : selectedCustomer.critical_60_plus > 0
                    ? 'Critical Overdue'
                    : 'Healthy'}
                </span>
              </div>
            </div>

            {/* Invoices List */}
            <div>
              <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider mb-2">
                Unpaid Invoices & Chronological Allocations ({selectedCustomer.unpaidInvoices.length})
              </h4>

              {selectedCustomer.unpaidInvoices.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground bg-muted/20 rounded-lg text-xs">
                  {selectedCustomer.totalOutstanding > 0
                    ? 'Outstanding is from historical opening balance ledger.'
                    : 'All invoices are fully paid.'}
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                        <th className="py-2 px-3">Order Ref</th>
                        <th className="py-2 px-3">Order Date</th>
                        <th className="py-2 px-3">Due Date</th>
                        <th className="py-2 px-3 text-center">Overdue</th>
                        <th className="py-2 px-3 text-right">Order Total</th>
                        <th className="py-2 px-3 text-right">Unpaid Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedCustomer.unpaidInvoices.map((inv) => (
                        <tr key={inv.orderId} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3">
                            <Link
                              href={`/sales-orders/${inv.orderId}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {inv.orderNumber}
                            </Link>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">
                            {inv.orderDate}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">
                            {inv.dueDate}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge
                              variant={
                                inv.bracket === 'critical'
                                  ? 'destructive'
                                  : inv.bracket === 'overdue'
                                  ? 'warning'
                                  : inv.bracket === 'due'
                                  ? 'info'
                                  : 'success'
                              }
                              className="text-[10px] px-1.5"
                            >
                              {inv.daysOverdue === 0 ? 'On Time' : `${inv.daysOverdue}d`}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            {formatCurrency(inv.totalAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                            {formatCurrency(inv.unpaidAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendWhatsAppReminder(selectedCustomer)}
                className="gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <Icons.share className="w-4 h-4" />
                WhatsApp Statement
              </Button>

              <div className="flex items-center gap-2">
                <Link href={`/customers/${selectedCustomer.customer.id}`}>
                  <Button variant="outline" size="sm">
                    Open Full Profile
                  </Button>
                </Link>
                <Button size="sm" onClick={() => setSelectedCustomer(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
