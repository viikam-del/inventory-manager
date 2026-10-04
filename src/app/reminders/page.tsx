'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';
import {
  AutomatedReminder,
  getPaymentReminders,
  getReorderReminders,
  getLowStockReminders,
  getOrderReminders
} from '@/lib/reminders';

export default function RemindersPage() {
  const [reminders, setReminders] = useState<AutomatedReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<string>('All');

  // Exclude dismissed from view
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAllReminders();
  }, []);

  async function fetchAllReminders() {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch virtual automated ones
      const [payments, reorders, lowStocks, orders] = await Promise.all([
        getPaymentReminders(),
        getReorderReminders(),
        getLowStockReminders(),
        getOrderReminders()
      ]);

      // 2. Fetch manual from DB (if any). We wrap in try/catch in case table is missing
      let manualReminders: AutomatedReminder[] = [];
      try {
        const { data: dbReminders, error: dbError } = await supabase
          .from('reminders')
          .select('*')
          .eq('is_deleted', false)
          .eq('status', 'Pending');

        if (!dbError && dbReminders) {
          manualReminders = dbReminders.map(r => ({
            id: r.id,
            type: r.type || 'Manual',
            title: r.title,
            description: r.description || '',
            reference_type: r.reference_type || 'Manual',
            reference_id: r.reference_id || '',
            whatsapp_number: r.whatsapp_number || null,
            whatsapp_template: r.whatsapp_template || '',
            priority: 'Medium',
            status: r.status
          }));
        }
      } catch (err) {
        // Table might not exist yet, ignore
      }

      setReminders([...payments, ...reorders, ...lowStocks, ...orders, ...manualReminders]);
    } catch (err: any) {
      console.error('Failed to load reminders', err);
      setError('Failed to load reminders. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleDismiss = async (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));

    // If it's a UUID (meaning it's from DB), we update DB
    if (/^[0-9a-fA-F]{8}-/.test(id)) {
      try {
        await supabase.from('reminders').update({ status: 'Dismissed' }).eq('id', id);
      } catch (_) {}
    }
  };

  const filteredReminders = useMemo(() => {
    return reminders
      .filter(r => !dismissedIds.has(r.id))
      .filter(r => filterType === 'All' || r.type === filterType);
  }, [reminders, filterType, dismissedIds]);

  const paymentCount = reminders.filter(r => r.type === 'Payment' && !dismissedIds.has(r.id)).length;
  const reorderCount = reminders.filter(r => r.type === 'Reorder' && !dismissedIds.has(r.id)).length;
  const lowStockCount = reminders.filter(r => r.type === 'LowStock' && !dismissedIds.has(r.id)).length;
  const manualCount = reminders.filter(r => r.type === 'Manual' && !dismissedIds.has(r.id)).length;

  return (
    <PageContainer>
      <PageHeader
        title="Reminders Engine"
        description="Smart automated alerts for overdue payments, reorders, low stock, and follow-ups"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAllReminders}
              disabled={loading}
              className="gap-1.5 h-9"
            >
              <Icons.refresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" asChild className="gap-1.5 h-9 shadow-xs">
              <Link href="/reminders/new">
                <Icons.bell className="w-4 h-4" />
                <span>+ Custom Reminder</span>
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Payment Overdue"
          value={paymentCount}
          icon={<Icons.payments className="w-5 h-5 text-rose-500" />}
          iconClassName="bg-rose-500/10 border-rose-500/20"
          description="Pending customer dues"
        />
        <StatCard
          title="Low Stock"
          value={lowStockCount}
          icon={<Icons.inventory className="w-5 h-5 text-amber-500" />}
          iconClassName="bg-amber-500/10 border-amber-500/20"
          description="Items below reorder limit"
        />
        <StatCard
          title="Predictive Reorders"
          value={reorderCount}
          icon={<Icons.trendUp className="w-5 h-5 text-blue-500" />}
          iconClassName="bg-blue-500/10 border-blue-500/20"
          description="Customers due for next order"
        />
        <StatCard
          title="Custom Alerts"
          value={manualCount}
          icon={<Icons.bell className="w-5 h-5 text-purple-500" />}
          iconClassName="bg-purple-500/10 border-purple-500/20"
          description="Manual follow-ups"
        />
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-2">
            {(['All', 'Payment', 'Reorder', 'LowStock', 'Order', 'Manual'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-md font-medium text-xs transition-all whitespace-nowrap ${
                  filterType === type
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground bg-muted/40'
                }`}
              >
                {type === 'All' ? 'All Alerts' : type}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5 mb-6">
          <CardContent className="p-4 flex items-center gap-3 text-destructive text-sm">
            <Icons.warning className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center justify-center space-y-3">
            <Icons.refresh className="w-7 h-7 animate-spin text-primary" />
            <p className="text-xs sm:text-sm text-muted-foreground">Analyzing operational data...</p>
          </CardContent>
        </Card>
      ) : filteredReminders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
              <Icons.check className="w-6 h-6 text-success" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">You are all caught up!</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              There are no pending reminders matching your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReminders.map(reminder => (
            <Card key={reminder.id} className={`flex flex-col ${reminder.priority === 'High' ? 'border-rose-500/50 shadow-sm' : ''}`}>
              <CardContent className="p-5 flex-1 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      {reminder.type === 'Payment' && <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">Payment Overdue</Badge>}
                      {reminder.type === 'LowStock' && <Badge variant="warning" className="text-[10px]">Low Stock</Badge>}
                      {reminder.type === 'Reorder' && <Badge variant="info" className="text-[10px]">Sales Follow-up</Badge>}
                      {reminder.type === 'Order' && <Badge variant="outline" className="border-purple-500/30 text-purple-600 bg-purple-500/10 text-[10px]">Order Status</Badge>}
                      {reminder.type === 'Manual' && <Badge variant="secondary" className="text-[10px]">Custom</Badge>}

                      {reminder.priority === 'High' && (
                        <Icons.warning className="w-3.5 h-3.5 text-rose-500" />
                      )}
                    </div>
                    <h3 className="font-semibold text-sm leading-tight text-foreground">{reminder.title}</h3>
                  </div>
                  <button onClick={() => handleDismiss(reminder.id)} className="text-muted-foreground hover:text-foreground shrink-0 p-1">
                    <Icons.close className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-3">
                  {reminder.description}
                </p>

                <div className="mt-auto pt-4 flex items-center justify-between gap-2 border-t border-border/50">
                  {reminder.whatsapp_number ? (
                    <Button asChild size="sm" className="h-8 text-[11px] gap-1.5 bg-[#25D366] hover:bg-[#1DA851] text-white">
                      <a
                        href={`https://wa.me/${reminder.whatsapp_number}?text=${encodeURIComponent(reminder.whatsapp_template)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icons.share className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    </Button>
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic">
                      No WhatsApp Action
                    </div>
                  )}

                  {reminder.reference_type === 'Customer' ? (
                    <Button variant="ghost" size="sm" asChild className="h-8 text-[11px] text-primary">
                      <Link href={`/customers/${reminder.reference_id}`}>Profile &rarr;</Link>
                    </Button>
                  ) : reminder.reference_type === 'Product' ? (
                    <Button variant="ghost" size="sm" asChild className="h-8 text-[11px] text-primary">
                      <Link href={`/products/${reminder.reference_id}`}>Details &rarr;</Link>
                    </Button>
                  ) : reminder.reference_type === 'PurchaseOrder' ? (
                    <Button variant="ghost" size="sm" asChild className="h-8 text-[11px] text-primary">
                      <Link href={`/purchase-orders/${reminder.reference_id}`}>View PO &rarr;</Link>
                    </Button>
                  ) : reminder.reference_type === 'SalesOrder' ? (
                    <Button variant="ghost" size="sm" asChild className="h-8 text-[11px] text-primary">
                      <Link href={`/sales-orders/${reminder.reference_id}`}>View SO &rarr;</Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
