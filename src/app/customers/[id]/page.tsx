'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';
import { Timeline } from '@/components/ui/timeline';
import { getAuditLogsForEntity, logAuditEvent, AuditLog } from '@/lib/audit';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  delivery_address: string | null;
  delivery_contact_person: string | null;
  delivery_contact_phone: string | null;
  gstin: string | null;
  is_gst_customer: boolean;
  is_dealer: boolean;
  default_due_days: number;
  credit_limit: number | null;
  opening_balance: number;
  notes: string | null;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState<number | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchCustomer() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', params.id)
        .eq('is_deleted', false)
        .single();

      if (supabaseError) throw supabaseError;
      setCustomer(data);
      if (data) {
        fetchLedger(data);
        fetchAuditLogs(data.id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load customer details';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAuditLogs(customerId: string) {
    try {
      const logs = await getAuditLogsForEntity('customer', customerId);
      setAuditLogs(logs);
    } catch (err) {
      console.warn('Failed to load customer audit logs', err);
    }
  }

  async function fetchLedger(cust: Customer) {
    setLedgerLoading(true);
    try {
      const [salesRes, paymentsRes] = await Promise.all([
        supabase.from('sales_orders').select('*').eq('customer_id', cust.id).eq('is_deleted', false),
        supabase.from('payments').select('*').eq('customer_id', cust.id).eq('is_deleted', false)
      ]);

      if (salesRes.error) throw salesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const sales = salesRes.data.map((s: any) => ({
        id: s.id,
        date: s.order_date,
        type: 'Sale',
        reference: s.order_number || s.so_number || 'SO',
        link: `/sales-orders/${s.id}`,
        status: s.status,
        amount: (Number(s.total_amount) + Number(s.gst_amount || 0)),
        isDebit: true // Owe us more
      }));

      const payments = paymentsRes.data.map((p: any) => ({
        id: p.id,
        date: p.payment_date,
        type: 'Payment',
        reference: p.payment_number || p.reference_number || 'PAY',
        link: `/payments/${p.id}`,
        status: p.payment_method || p.method || 'Payment',
        amount: Number(p.amount),
        isDebit: false // Paid us
      }));

      const combined = [...sales, ...payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let running = Number(cust.opening_balance || 0);
      const withBalance = combined.map(entry => {
        if (entry.isDebit) running += entry.amount;
        else running -= entry.amount;
        return { ...entry, running_balance: running };
      });

      setLedger(withBalance);
      setOutstandingBalance(running);
    } catch (err) {
      console.error('Failed to load ledger', err);
    } finally {
      setLedgerLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    async function load() {
      await fetchCustomer();
    }
    load();
    return () => { isMounted = false; };
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this customer record?')) return;

    setActionLoading(true);
    try {
      const { error: supabaseError } = await supabase
        .from('customers')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', params.id);

      if (supabaseError) throw supabaseError;
      void logAuditEvent('customer', params.id as string, 'delete', null, {
        company_name: customer?.company_name,
        contact_person: customer?.contact_person,
        phone: customer?.phone,
      });
      router.push('/customers');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete customer';
      alert(message);
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading customer details...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !customer) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center px-4">
          <Card className="max-w-md w-full border-destructive/20 text-center p-6 space-y-4">
            <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-bold">Customer Not Found</h2>
            <p className="text-muted-foreground text-xs">{error || 'The requested customer could not be located.'}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/customers">
                <Icons.back className="w-4 h-4 mr-2" /> Back to Customers
              </Link>
            </Button>
          </Card>
        </div>
      </PageContainer>
    );
  }

  const creditLimit = customer.credit_limit ? Number(customer.credit_limit) : 0;
  const currentDue = outstandingBalance ?? 0;
  const availableCredit = creditLimit > 0 ? creditLimit - currentDue : null;
  const utilizationPct = creditLimit > 0 ? Math.max(0, (currentDue / creditLimit) * 100) : 0;
  const isCreditExceeded = creditLimit > 0 && currentDue > creditLimit;
  const isCreditWarning = creditLimit > 0 && utilizationPct >= 80 && !isCreditExceeded;

  return (
    <PageContainer>
      <PageHeader
        title={customer.company_name}
        description="Customer Account Dashboard"
        backHref="/customers"
        badge={
          <div className="flex gap-1.5">
            {customer.is_gst_customer ? (
              <Badge variant="success">GST Registered</Badge>
            ) : (
              <Badge variant="outline">Non-GST</Badge>
            )}
            {customer.is_dealer && <Badge variant="secondary">Dealer</Badge>}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 gap-1.5 text-xs">
              <Icons.print className="w-3.5 h-3.5" /> Print / PDF
            </Button>

            {customer.whatsapp && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 gap-1.5 text-xs bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 border-[#25D366]/30 dark:bg-[#25D366]/15 dark:text-[#25D366]"
              >
                <a
                  href={`https://wa.me/${customer.whatsapp}?text=${encodeURIComponent(`Hello ${customer.contact_person ? customer.contact_person : customer.company_name},\n\nHope you are doing well!\n\nRegards,\nRainbow Digital Solutions`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icons.share className="w-3.5 h-3.5" /> WhatsApp Message
                </a>
              </Button>
            )}

            <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs">
              <Link href={`/customers/${customer.id}/edit`}>
                <Icons.edit className="w-3.5 h-3.5" /> Edit
              </Link>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={actionLoading}
              className="h-8 text-xs text-muted-foreground hover:text-destructive"
            >
              <Icons.trash className="w-3.5 h-3.5" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Contact Block */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3 hidden sm:flex">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.customers className="w-4 h-4 text-primary" /> Contact Details & Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4 sm:pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col gap-1 pb-3 sm:pb-0 sm:border-0 border-b border-border/50">
                <span className="text-xs text-muted-foreground">Contact Person</span>
                <span className="font-semibold text-foreground">{customer.contact_person || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 pb-3 sm:pb-0 sm:border-0 border-b border-border/50">
                <span className="text-xs text-muted-foreground">Phone</span>
                <span className="font-mono font-medium text-foreground">{customer.phone}</span>
              </div>
              <div className="flex flex-col gap-1 pb-3 sm:pb-0 sm:border-0 border-b border-border/50">
                <span className="text-xs text-muted-foreground">WhatsApp</span>
                <span className="font-mono text-foreground">{customer.whatsapp || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 pb-3 sm:pb-0 sm:border-0 border-b border-border/50">
                <span className="text-xs text-muted-foreground">Email</span>
                <span className="font-medium text-foreground">{customer.email || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Company Address</span>
                <span className="font-medium text-foreground whitespace-pre-wrap">{customer.address || '—'}</span>
              </div>
            </div>

            <div className="pt-6 border-t border-border/50">
              <div className="flex items-center gap-2 mb-4">
                <Icons.delivery className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery Profile</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Delivery Contact</span>
                  <span className="font-semibold text-foreground">{customer.delivery_contact_person || '—'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Delivery Phone</span>
                  <span className="font-mono font-medium text-foreground">{customer.delivery_contact_phone || '—'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Delivery Address</span>
                  <span className="font-medium text-foreground whitespace-pre-wrap">{customer.delivery_address || '—'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Block */}
        <Card>
          <CardHeader className="pb-3 hidden sm:flex">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Icons.payments className="w-4 h-4 text-primary" /> Billing & Credit
              </span>
              {creditLimit > 0 && (
                <Badge
                  variant={isCreditExceeded ? 'destructive' : isCreditWarning ? 'warning' : 'success'}
                  className="text-[10px]"
                >
                  {isCreditExceeded
                    ? 'Limit Breached'
                    : isCreditWarning
                    ? 'High Exposure'
                    : 'Healthy Credit'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 sm:pt-0 text-sm">
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <span className="text-muted-foreground">GSTIN</span>
              <span className="font-mono font-semibold text-foreground">{customer.gstin || '—'}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Credit Limit</span>
              <span className="font-bold text-foreground">
                {customer.credit_limit ? `₹${customer.credit_limit.toLocaleString('en-IN')}` : <span className="text-muted-foreground italic font-normal text-xs">No Limit</span>}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Opening Balance</span>
              <span className="font-mono font-semibold text-foreground">₹{customer.opening_balance.toLocaleString('en-IN')}</span>
            </div>
            {outstandingBalance !== null && (
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground font-semibold">Current Outstanding</span>
                <span className={`font-mono font-bold ${outstandingBalance > 0 ? 'text-destructive' : 'text-success'}`}>
                  {outstandingBalance < 0
                    ? `₹${Math.abs(outstandingBalance).toLocaleString('en-IN')} (Cr)`
                    : `₹${outstandingBalance.toLocaleString('en-IN')}`}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Due Term</span>
              <span className="font-medium text-foreground">{customer.default_due_days} Days</span>
            </div>

            {/* Credit Utilization Bar & Headroom */}
            {creditLimit > 0 && (
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Credit Utilization</span>
                  <span
                    className={cn(
                      'font-mono font-bold',
                      isCreditExceeded
                        ? 'text-destructive'
                        : isCreditWarning
                        ? 'text-amber-500'
                        : 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {utilizationPct.toFixed(1)}%
                  </span>
                </div>

                <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/40">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      isCreditExceeded
                        ? 'bg-destructive'
                        : isCreditWarning
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    )}
                    style={{ width: `${Math.min(100, utilizationPct)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-muted-foreground">
                    {isCreditExceeded ? 'Excess Exposure:' : 'Available Headroom:'}
                  </span>
                  <span
                    className={cn(
                      'font-mono font-bold',
                      isCreditExceeded
                        ? 'text-destructive'
                        : 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {isCreditExceeded
                      ? `+₹${(currentDue - creditLimit).toLocaleString('en-IN')}`
                      : `₹${(availableCredit ?? 0).toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {customer.notes && (
        <Card className="mt-4 sm:mt-6 bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Internal Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap">{customer.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Ledger UI Stub */}
      <div className="mt-6 sm:mt-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Icons.receipts className="w-5 h-5 text-primary" /> Account Ledger
          </h3>
          <Button variant="outline" size="sm" asChild className="h-8 text-xs shrink-0 w-full sm:w-auto">
            <Link href={`/payments/new?customer=${customer.id}`}>
              <Icons.add className="w-3.5 h-3.5 mr-1" /> Add Payment Entry
            </Link>
          </Button>
        </div>

        {ledgerLoading ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 flex items-center justify-center">
              <Icons.refresh className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
            </CardContent>
          </Card>
        ) : ledger.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center">
              <Icons.search className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">No transactions available yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Sales orders and payment history linked to {customer.company_name} will automatically appear in this section.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/60 border-b border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status/Info</th>
                    <th className="px-4 py-3 text-right">Debit (Sale)</th>
                    <th className="px-4 py-3 text-right">Credit (Paid)</th>
                    <th className="px-4 py-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr className="bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground text-xs italic">Opening Balance</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-medium">{customer.opening_balance > 0 ? `₹${customer.opening_balance.toLocaleString('en-IN')}` : ''}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{customer.opening_balance <= 0 ? `₹${Math.abs(customer.opening_balance).toLocaleString('en-IN')}` : ''}</td>
                    <td className="px-4 py-3 text-right font-bold">₹{Number(customer.opening_balance).toLocaleString('en-IN')}</td>
                  </tr>

                  {ledger.map((entry, idx) => (
                    <tr key={`${entry.type}-${entry.id}-${idx}`} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className={`font-medium ${entry.type === 'Sale' ? 'text-primary' : 'text-success'}`}>
                            {entry.type}
                          </span>
                          <Link href={entry.link} className="font-mono text-[10px] text-muted-foreground hover:underline">
                            {entry.reference}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {entry.type === 'Sale' ? (
                          <Badge variant="outline" className="text-[10px] bg-background">{entry.status}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">{entry.status}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {entry.isDebit && entry.amount > 0 ? `₹${entry.amount.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-success">
                        {!entry.isDebit && entry.amount > 0 ? `₹${entry.amount.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        {entry.running_balance < 0 ? (
                          <span className="text-success">₹{Math.abs(entry.running_balance).toLocaleString('en-IN')} (Cr)</span>
                        ) : (
                          `₹${entry.running_balance.toLocaleString('en-IN')}`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Customer Activity & Audit Timeline */}
        <div className="mt-8">
          <Timeline
            logs={auditLogs}
            title="Customer Activity & Audit History"
            emptyMessage="No audit logs recorded for this customer yet."
          />
        </div>
      </div>
    </PageContainer>
  );
}
