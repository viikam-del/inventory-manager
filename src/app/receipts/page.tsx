'use client';

import { useEffect, useState, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

interface Receipt {
  id: string;
  receipt_number: string;
  purchase_order_id: string | null;
  supplier_id: string | null;
  supplier_name?: string;
  po_number?: string;
  receipt_date: string;
  status: string;
  delivery_charges: number;
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const router = useRouter();

  useEffect(() => {
    fetchReceipts();
  }, []);

  async function fetchReceipts() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('receipts')
        .select('id, receipt_number, purchase_order_id, supplier_id, receipt_date, status, delivery_charges, suppliers(company_name), purchase_orders(po_number)')
        .eq('is_deleted', false)
        .order('receipt_date', { ascending: false }).limit(1000);

      if (supabaseError) throw supabaseError;

      const formatted = (data || []).map(r => ({
        ...r,
        supplier_name: (r.suppliers as any)?.company_name,
        po_number: (r.purchase_orders as any)?.po_number
      }));

      setReceipts(formatted);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch goods receipts');
    } finally {
      setLoading(false);
    }
  }

  const filtered = receipts.filter(r =>
    r.receipt_number.toLowerCase().includes(deferredSearch.toLowerCase()) ||
    (r.supplier_name && r.supplier_name.toLowerCase().includes(deferredSearch.toLowerCase())) ||
    (r.po_number && r.po_number.toLowerCase().includes(deferredSearch.toLowerCase()))
  );

  return (
    <PageContainer>
      <PageHeader
        title="Goods Received Notes (GRN)"
        description="Verify inbound vendor shipments, record inspection data, and automatically increment stock inventory"
        badge={
          <Badge variant="secondary" className="font-mono text-[11px]">
            {receipts.length} Receipts
          </Badge>
        }
        actions={
          <Button size="sm" asChild>
            <Link href="/receipts/new">
              <Icons.add className="w-3.5 h-3.5 mr-1.5" />
              New Receipt (GRN)
            </Link>
          </Button>
        }
      />

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by GRN #, PO #, or supplier..."
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
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading goods receipts...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 text-center py-8">
          <CardContent className="space-y-3">
            <Icons.warning className="w-8 h-8 text-destructive mx-auto" />
            <p className="font-semibold text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchReceipts()}>
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
                  <th className="px-5 py-3">GRN Number</th>
                  <th className="px-5 py-3">Originating PO</th>
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3">Received Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.length > 0 ? (
                  filtered.map((receipt) => (
                    <tr key={receipt.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/receipts/${receipt.id}`}
                          className="font-mono font-bold text-primary hover:underline"
                        >
                          {receipt.receipt_number}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {receipt.po_number ? (
                          <Link
                            href={`/purchase-orders/${receipt.purchase_order_id}`}
                            className="font-mono text-xs bg-muted/80 text-foreground px-2 py-0.5 rounded border border-border/60 hover:bg-muted transition-colors inline-block"
                          >
                            {receipt.po_number}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Direct Entry</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {receipt.supplier_name || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {new Date(receipt.receipt_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="success" className="gap-1">
                          <Icons.success className="w-3 h-3" />
                          {receipt.status || 'Received'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                          <Link href={`/receipts/${receipt.id}`}>
                            View Details <Icons.forward className="w-3 h-3 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Icons.receipts className="w-8 h-8 text-muted-foreground/60" />
                        <p className="font-medium text-sm">No goods receipts found matching your search.</p>
                        {search && (
                          <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                            Clear Search
                          </Button>
                        )}
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
