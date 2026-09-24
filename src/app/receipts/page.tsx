'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface Receipt {
  id: string;
  receipt_number: string;
  purchase_order_id: string | null;
  supplier_id: string | null;
  supplier_name?: string;
  po_number?: string;
  receipt_date: string;
  status: string;
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchReceipts();
  }, []);

  async function fetchReceipts() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('receipts')
        .select('*, suppliers(company_name), purchase_orders(po_number)')
        .eq('is_deleted', false)
        .order('receipt_date', { ascending: false });

      if (supabaseError) throw supabaseError;

      const formatted = (data || []).map(r => ({
        ...r,
        supplier_name: (r.suppliers as any)?.company_name,
        po_number: (r.purchase_orders as any)?.po_number
      }));

      setReceipts(formatted);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch receipts');
    } finally {
      setLoading(false);
    }
  }

  const filtered = receipts.filter(r =>
    r.receipt_number.toLowerCase().includes(search.toLowerCase()) ||
    (r.supplier_name && r.supplier_name.toLowerCase().includes(search.toLowerCase())) ||
    (r.po_number && r.po_number.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in slide-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Goods Received Notes (GRN)</h1>
          <p className="text-muted-foreground mt-1">Track inbound shipments and stock increments</p>
        </div>
        <Button asChild>
          <Link href="/receipts/new">
            <Icons.add className="w-4 h-4 mr-2" /> New Receipt (GRN)
          </Link>
        </Button>
      </div>

      <div className="mb-6 relative max-w-md">
        <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by GRN number, PO, or supplier..."
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center">
            <Icons.refresh className="animate-spin h-10 w-10 text-primary mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Loading goods receipts...</p>
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
                  <th className="px-6 py-3">GRN Number</th>
                  <th className="px-6 py-3">PO Reference</th>
                  <th className="px-6 py-3">Supplier</th>
                  <th className="px-6 py-3">Received Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length > 0 ? (
                  filtered.map((receipt) => (
                    <tr key={receipt.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-primary">
                        {receipt.receipt_number}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        {receipt.po_number ? (
                          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{receipt.po_number}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Direct Entry</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {receipt.supplier_name || '—'}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(receipt.receipt_date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="success">
                          <Icons.success className="w-3 h-3 mr-1" />
                          {receipt.status || 'Received'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/receipts/${receipt.id}`}>
                            View <Icons.forward className="w-3.5 h-3.5 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No goods receipts found.
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
