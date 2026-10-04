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

interface SupplierReturnLine {
  id: string;
  product_id: string;
  quantity_returned: number;
  unit_cost: number;
  total_amount: number;
  return_reason: string | null;
  products?: {
    name: string;
    sku_code: string;
    unit: string;
    current_stock: number;
  };
}

interface SupplierReturn {
  id: string;
  return_number: string;
  supplier_id: string;
  original_po_number: string | null;
  return_date: string;
  resolution_type: 'Replacement' | 'Refund' | 'Credit Note';
  notes: string | null;
  status: 'Draft' | 'Pending' | 'Shipped' | 'Completed' | 'Cancelled';
  is_stock_deducted: boolean;
  stock_deducted_at: string | null;
  total_amount: number;
  created_at: string;
  suppliers?: {
    company_name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    gstin?: string | null;
  };
}

export default function SupplierReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [returnRecord, setReturnRecord] = useState<SupplierReturn | null>(null);
  const [lines, setLines] = useState<SupplierReturnLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReturnDetails = async () => {
    setLoading(true);
    try {
      const { data: returnData, error: returnError } = await supabase
        .from('supplier_returns')
        .select(`
          *,
          suppliers (
            company_name,
            phone,
            email,
            address,
            gstin
          )
        `)
        .eq('id', params.id)
        .eq('is_deleted', false)
        .single();

      if (returnError) throw returnError;
      setReturnRecord(returnData);

      const { data: linesData, error: linesError } = await supabase
        .from('supplier_return_lines')
        .select(`
          *,
          products (
            name,
            sku_code,
            unit,
            current_stock
          )
        `)
        .eq('supplier_return_id', params.id);

      if (linesError) throw linesError;
      setLines(linesData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load return details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturnDetails();
  }, [params.id]);

  const handleDeleteReturn = async () => {
    if (!confirm('Move this Supplier Return to archive? This will soft-delete the record.')) return;
    setActionLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('supplier_returns')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      if (deleteError) throw deleteError;
      router.push('/supplier-returns');
    } catch (err: any) {
      alert(err.message || 'Failed to archive supplier return');
      setActionLoading(false);
    }
  };

  const handleDeductInventory = async () => {
    if (!returnRecord) return;
    if (returnRecord.is_stock_deducted) {
      alert('Stock has already been deducted for this supplier return.');
      return;
    }

    const totalUnits = lines.reduce((acc, l) => acc + Number(l.quantity_returned), 0);

    if (
      !confirm(
        `Deduct ${totalUnits} returned units from warehouse inventory for ${returnRecord.return_number}?\n\n` +
          `• Warehouse stock will be reduced\n` +
          `• 'Out' adjustment audit records will be logged\n` +
          `• Status will be updated to Shipped`
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      // 1. Decrement product stocks and log audit adjustments
      for (const line of lines) {
        if (!line.product_id || Number(line.quantity_returned) <= 0) continue;

        const { data: prod, error: prodErr } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', line.product_id)
          .single();

        if (prodErr) throw prodErr;

        const currentStock = Number(prod?.current_stock) || 0;
        const newStock = Math.max(0, currentStock - Number(line.quantity_returned));

        const { error: updateErr } = await supabase
          .from('products')
          .update({ current_stock: newStock })
          .eq('id', line.product_id);

        if (updateErr) throw updateErr;

        const { error: adjErr } = await supabase
          .from('stock_adjustments')
          .insert([
            {
              product_id: line.product_id,
              adjustment_type: 'Out',
              quantity: Number(line.quantity_returned),
              reason: `Supplier Return: ${returnRecord.return_number}`,
              reference_type: 'Supplier Return',
              reference_id: returnRecord.id,
            },
          ]);

        if (adjErr) throw adjErr;
      }

      // 2. Mark return as deducted & Shipped
      const nowIso = new Date().toISOString();
      const nextStatus = returnRecord.status === 'Draft' || returnRecord.status === 'Pending' ? 'Shipped' : returnRecord.status;
      const { error: updateReturnError } = await supabase
        .from('supplier_returns')
        .update({
          is_stock_deducted: true,
          stock_deducted_at: nowIso,
          status: nextStatus,
        })
        .eq('id', returnRecord.id);

      if (updateReturnError) throw updateReturnError;

      setReturnRecord(prev =>
        prev
          ? {
              ...prev,
              is_stock_deducted: true,
              stock_deducted_at: nowIso,
              status: nextStatus,
            }
          : null
      );

      // Refresh lines to show updated product current_stock
      fetchReturnDetails();
      alert(`Success! ${totalUnits} units deducted from warehouse inventory.`);
    } catch (err: any) {
      alert(err.message || 'Failed to deduct stock');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: SupplierReturn['status']) => {
    if (!returnRecord) return;
    setActionLoading(true);
    try {
      const { error: updateErr } = await supabase
        .from('supplier_returns')
        .update({ status: newStatus })
        .eq('id', returnRecord.id);

      if (updateErr) throw updateErr;

      setReturnRecord(prev => (prev ? { ...prev, status: newStatus } : null));
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              Loading supplier return details...
            </p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !returnRecord) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Card className="max-w-md w-full border-destructive/20 text-center p-6 space-y-4">
            <Icons.warning className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-bold">Return Record Not Found</h2>
            <p className="text-muted-foreground text-xs">
              {error || 'The requested supplier return note could not be located or has been archived.'}
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/supplier-returns">
                <Icons.back className="w-4 h-4 mr-2" /> Back to Returns
              </Link>
            </Button>
          </Card>
        </div>
      </PageContainer>
    );
  }

  const totalCalculatedValue = lines.reduce(
    (acc, l) => acc + (Number(l.quantity_returned) || 0) * (Number(l.unit_cost) || 0),
    0
  );

  const totalUnits = lines.reduce((acc, l) => acc + (Number(l.quantity_returned) || 0), 0);

  const getStatusBadge = (status: SupplierReturn['status']) => {
    switch (status) {
      case 'Completed':
        return (
          <Badge variant="success" className="gap-1 font-mono text-[11px]">
            <Icons.check className="w-3.5 h-3.5" /> Completed
          </Badge>
        );
      case 'Shipped':
        return (
          <Badge variant="info" className="gap-1 font-mono text-[11px]">
            <Icons.out className="w-3.5 h-3.5" /> Shipped / Dispatched
          </Badge>
        );
      case 'Pending':
        return (
          <Badge variant="warning" className="gap-1 font-mono text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending Dispatch
          </Badge>
        );
      case 'Draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'Cancelled':
        return (
          <Badge variant="destructive" className="gap-1 font-mono text-[11px]">
            <Icons.close className="w-3.5 h-3.5" /> Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const whatsappMessage = encodeURIComponent(
    `*DEBIT NOTE / PURCHASE RETURN: ${returnRecord.return_number}*\n` +
      `Supplier: ${returnRecord.suppliers?.company_name || 'Vendor'}\n` +
      `Original PO: ${returnRecord.original_po_number || 'N/A'}\n` +
      `Resolution: ${returnRecord.resolution_type}\n` +
      `Total Debit Amount: ₹${Number(returnRecord.total_amount || totalCalculatedValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      `Date: ${new Date(returnRecord.return_date).toLocaleDateString('en-IN')}\n\n` +
      `*Returned Items Breakdown:*\n` +
      lines
        .map(
          l =>
            `• ${l.quantity_returned} ${l.products?.unit || 'units'} x ${l.products?.name} @ ₹${Number(l.unit_cost).toLocaleString('en-IN')} [Reason: ${l.return_reason || 'Return'}]`
        )
        .join('\n')
  );

  return (
    <PageContainer>
      <PageHeader
        title={returnRecord.return_number}
        description={`Supplier return / debit note dispatched on ${new Date(returnRecord.return_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        backHref="/supplier-returns"
        badge={getStatusBadge(returnRecord.status)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!returnRecord.is_stock_deducted && returnRecord.status !== 'Cancelled' && (
              <Button
                variant="warning"
                size="sm"
                onClick={handleDeductInventory}
                disabled={actionLoading}
                className="h-8 gap-1.5 text-xs shadow-xs"
              >
                {actionLoading ? (
                  <Icons.refresh className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Icons.out className="w-3.5 h-3.5" />
                )}
                Deduct from Stock ({totalUnits} units)
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 gap-1.5 text-xs"
            >
              <Icons.print className="w-3.5 h-3.5" /> Print / PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1.5 text-xs bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 border-[#25D366]/30 dark:bg-[#25D366]/15 dark:text-[#25D366]"
            >
              <a
                href={`https://wa.me/?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icons.share className="w-3.5 h-3.5" /> Share WhatsApp
              </a>
            </Button>

            {/* Lifecycle Status Management Buttons */}
            {returnRecord.status === 'Draft' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateStatus('Pending')}
                disabled={actionLoading}
                className="h-8 gap-1.5 text-xs"
              >
                <Icons.clock className="w-3.5 h-3.5 text-amber-500" /> Mark Pending
              </Button>
            )}

            {returnRecord.status === 'Pending' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateStatus('Shipped')}
                disabled={actionLoading}
                className="h-8 gap-1.5 text-xs"
              >
                <Icons.out className="w-3.5 h-3.5 text-blue-500" /> Mark Shipped
              </Button>
            )}

            {returnRecord.status === 'Shipped' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateStatus('Completed')}
                disabled={actionLoading}
                className="h-8 gap-1.5 text-xs"
              >
                <Icons.check className="w-3.5 h-3.5 text-emerald-500" /> Mark Completed
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeleteReturn}
              disabled={actionLoading}
              className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Archive Record"
            >
              <Icons.trash className="w-3.5 h-3.5" />
            </Button>
          </div>
        }
      />

      {/* Printable Debit Note Header (Visible only when printing) */}
      <div className="hidden print:block mb-8 border-b pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">DEBIT NOTE / PURCHASE RETURN</h1>
            <p className="text-sm font-mono text-muted-foreground">Document #: {returnRecord.return_number}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">INVENTORY MANAGER ERP</p>
            <p className="text-xs text-muted-foreground">Date: {new Date(returnRecord.return_date).toLocaleDateString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {/* Supplier & Billing Origin Card */}
        <Card className="shadow-xs border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.suppliers className="w-4 h-4 text-primary" /> Vendor & Origin Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Supplier:</span>
              <span className="font-semibold text-foreground">
                <Link
                  href={`/suppliers/${returnRecord.supplier_id}`}
                  className="hover:underline hover:text-primary transition-colors"
                >
                  {returnRecord.suppliers?.company_name || 'Vendor'}
                </Link>
              </span>
            </div>
            {returnRecord.suppliers?.gstin && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Vendor GSTIN:</span>
                <span className="font-mono text-foreground">{returnRecord.suppliers.gstin}</span>
              </div>
            )}
            {returnRecord.suppliers?.phone && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Phone Contact:</span>
                <span className="font-medium text-foreground">{returnRecord.suppliers.phone}</span>
              </div>
            )}
            {returnRecord.suppliers?.email && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium text-foreground">{returnRecord.suppliers.email}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border/60">
              <span className="text-muted-foreground">Original PO Ref:</span>
              <span className="font-medium text-foreground">
                {returnRecord.original_po_number ? (
                  <span className="font-mono text-xs bg-muted/80 text-foreground px-2 py-0.5 rounded border border-border/60">
                    {returnRecord.original_po_number}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs italic">Not Provided</span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Reverse Logistics & Settlement Card */}
        <Card className="shadow-xs border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.returns className="w-4 h-4 text-primary" /> Settlement & Stock Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Resolution Agreement:</span>
              <span className="font-semibold text-foreground">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  {returnRecord.resolution_type}
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Dispatch / Return Date:</span>
              <span className="font-medium text-foreground">
                {new Date(returnRecord.return_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border/60">
              <span className="text-muted-foreground">Warehouse Stock Status:</span>
              <span>
                {returnRecord.is_stock_deducted ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                    <Icons.check className="w-3.5 h-3.5" />
                    Deducted from Stock on{' '}
                    {returnRecord.stock_deducted_at
                      ? new Date(returnRecord.stock_deducted_at).toLocaleDateString('en-IN')
                      : 'Yes'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                    <Icons.warning className="w-3.5 h-3.5" />
                    Pending Stock Deduction
                  </span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Returned Line Items Table */}
      <Card className="shadow-xs border-border/70 overflow-hidden mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Icons.products className="w-4 h-4 text-primary" /> Returned Line Items ({lines.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Warehouse goods returned back to vendor with debit valuation
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-muted/60 border-y border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Product Name</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3 text-right">Qty Returned</th>
                <th className="px-5 py-3 text-right">Unit Cost</th>
                <th className="px-5 py-3">Return Reason</th>
                <th className="px-5 py-3 text-right">Debit Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {lines.map(line => {
                const lineTotal =
                  (Number(line.quantity_returned) || 0) * (Number(line.unit_cost) || 0);

                return (
                  <tr key={line.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-foreground">
                      <div className="space-y-0.5">
                        <Link
                          href={`/products/${line.product_id}`}
                          className="hover:underline hover:text-primary transition-colors"
                        >
                          {line.products?.name || 'Unknown Product'}
                        </Link>
                        {line.products && (
                          <div className="text-[10px] text-muted-foreground">
                            Current Stock in WH: {line.products.current_stock} {line.products.unit}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">
                      {line.products?.sku_code || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-foreground">
                      {line.quantity_returned}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        {line.products?.unit}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                      ₹{Number(line.unit_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted border border-border/60">
                        {line.return_reason || 'Return'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-foreground">
                      ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Valuation & Breakdown Footer */}
        <div className="p-4 sm:p-6 bg-muted/20 border-t border-border/60 flex flex-col items-end space-y-1.5 text-xs sm:text-sm">
          <div className="flex justify-between w-full max-w-sm text-muted-foreground">
            <span>Total Units Returned:</span>
            <span className="font-mono font-medium text-foreground">{totalUnits} units</span>
          </div>
          <div className="flex justify-between w-full max-w-sm text-muted-foreground">
            <span>Stock Inventory Deduction:</span>
            <span className={`font-mono font-medium ${returnRecord.is_stock_deducted ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {returnRecord.is_stock_deducted ? 'Completed' : 'Pending'}
            </span>
          </div>
          <div className="flex justify-between w-full max-w-sm pt-2 border-t border-border text-base font-bold text-foreground">
            <span>Total Debit Value:</span>
            <span className="font-mono text-primary">
              ₹
              {Number(returnRecord.total_amount || totalCalculatedValue).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </Card>

      {/* Remarks Card */}
      {returnRecord.notes && (
        <Card className="shadow-xs border-border/70 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dispatch & Settlement Remarks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">
              {returnRecord.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
