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

interface ReturnLine {
  id: string;
  product_id: string;
  quantity_returned: number;
  unit_price: number;
  total_amount: number;
  condition: 'Good' | 'Damaged' | 'Defective';
  return_reason: string | null;
  products?: {
    name: string;
    sku_code: string;
    unit: string;
    current_stock: number;
  };
}

interface CustomerReturn {
  id: string;
  return_number: string;
  customer_id: string;
  original_invoice_number: string | null;
  return_date: string;
  resolution_type: 'Replacement' | 'Refund' | 'Credit Note';
  notes: string | null;
  status: 'Pending' | 'Approved' | 'Completed' | 'Rejected';
  is_restocked: boolean;
  restocked_at: string | null;
  total_amount: number;
  created_at: string;
  customers?: {
    company_name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
}

export default function CustomerReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [returnRecord, setReturnRecord] = useState<CustomerReturn | null>(null);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReturnDetails = async () => {
    setLoading(true);
    try {
      const { data: returnData, error: returnError } = await supabase
        .from('customer_returns')
        .select(`
          *,
          customers (
            company_name,
            phone,
            email,
            address
          )
        `)
        .eq('id', params.id)
        .eq('is_deleted', false)
        .single();

      if (returnError) throw returnError;
      setReturnRecord(returnData);

      const { data: linesData, error: linesError } = await supabase
        .from('customer_return_lines')
        .select(`
          *,
          products (
            name,
            sku_code,
            unit,
            current_stock
          )
        `)
        .eq('customer_return_id', params.id);

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
    if (!confirm('Move this Customer Return record to archive? This will soft-delete the record.')) return;
    setActionLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('customer_returns')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      if (deleteError) throw deleteError;
      router.push('/customer-returns');
    } catch (err: any) {
      alert(err.message || 'Failed to archive customer return');
      setActionLoading(false);
    }
  };

  const handleRestockInventory = async () => {
    if (!returnRecord) return;
    if (returnRecord.is_restocked) {
      alert('This return has already been restocked into warehouse inventory.');
      return;
    }

    const goodLines = lines.filter(l => l.condition === 'Good' && Number(l.quantity_returned) > 0);
    const totalGoodUnits = goodLines.reduce((acc, l) => acc + Number(l.quantity_returned), 0);

    if (totalGoodUnits === 0) {
      alert("None of the returned items are marked in 'Good' condition. Only salable items can be restocked.");
      return;
    }

    if (
      !confirm(
        `Restock ${totalGoodUnits} salable units (Good condition) from ${returnRecord.return_number} into live inventory?\n\n` +
          `• Warehouse stock will be updated\n` +
          `• Stock adjustment audit logs will be recorded\n` +
          `• Return status will become Completed`
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      // 1. Increment product stocks and log audit adjustments
      for (const line of goodLines) {
        const { data: prod, error: prodErr } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', line.product_id)
          .single();

        if (prodErr) throw prodErr;

        const currentStock = Number(prod?.current_stock) || 0;
        const newStock = currentStock + Number(line.quantity_returned);

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
              adjustment_type: 'In',
              quantity: Number(line.quantity_returned),
              reason: `Customer Return Restock: ${returnRecord.return_number}`,
              reference_type: 'Customer Return',
              reference_id: returnRecord.id,
            },
          ]);

        if (adjErr) throw adjErr;
      }

      // 2. Mark return as restocked & Completed
      const nowIso = new Date().toISOString();
      const { error: updateReturnError } = await supabase
        .from('customer_returns')
        .update({
          is_restocked: true,
          restocked_at: nowIso,
          status: 'Completed',
        })
        .eq('id', returnRecord.id);

      if (updateReturnError) throw updateReturnError;

      setReturnRecord(prev =>
        prev
          ? {
              ...prev,
              is_restocked: true,
              restocked_at: nowIso,
              status: 'Completed',
            }
          : null
      );

      // Refresh lines to show updated product stock
      fetchReturnDetails();
      alert(`Success! ${totalGoodUnits} units restocked and return marked as Completed.`);
    } catch (err: any) {
      alert(err.message || 'Failed to restock inventory');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: CustomerReturn['status']) => {
    if (!returnRecord) return;
    setActionLoading(true);
    try {
      const { error: updateErr } = await supabase
        .from('customer_returns')
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
              Loading customer return details...
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
              {error || 'The requested customer return note could not be located or has been archived.'}
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/customer-returns">
                <Icons.back className="w-4 h-4 mr-2" /> Back to Returns
              </Link>
            </Button>
          </Card>
        </div>
      </PageContainer>
    );
  }

  const totalCalculatedValue = lines.reduce(
    (acc, l) => acc + (Number(l.quantity_returned) || 0) * (Number(l.unit_price) || 0),
    0
  );

  const totalUnits = lines.reduce((acc, l) => acc + (Number(l.quantity_returned) || 0), 0);
  const goodUnits = lines
    .filter(l => l.condition === 'Good')
    .reduce((acc, l) => acc + (Number(l.quantity_returned) || 0), 0);
  const damagedOrDefectiveUnits = lines
    .filter(l => l.condition !== 'Good')
    .reduce((acc, l) => acc + (Number(l.quantity_returned) || 0), 0);

  const getStatusBadge = (status: CustomerReturn['status']) => {
    switch (status) {
      case 'Completed':
        return (
          <Badge variant="success" className="gap-1 font-mono text-[11px]">
            <Icons.check className="w-3.5 h-3.5" /> Completed
          </Badge>
        );
      case 'Approved':
        return (
          <Badge variant="info" className="gap-1 font-mono text-[11px]">
            <Icons.success className="w-3.5 h-3.5" /> Approved
          </Badge>
        );
      case 'Pending':
        return (
          <Badge variant="warning" className="gap-1 font-mono text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending
          </Badge>
        );
      case 'Rejected':
        return (
          <Badge variant="destructive" className="gap-1 font-mono text-[11px]">
            <Icons.close className="w-3.5 h-3.5" /> Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConditionBadge = (condition: ReturnLine['condition']) => {
    switch (condition) {
      case 'Good':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
            Good (Salable)
          </span>
        );
      case 'Damaged':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap">
            Damaged (Box/Outer)
          </span>
        );
      case 'Defective':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20 whitespace-nowrap">
            Defective (Faulty)
          </span>
        );
      default:
        return <span className="text-xs text-muted-foreground">{condition}</span>;
    }
  };

  const whatsappMessage = encodeURIComponent(
    `*Customer Return Note: ${returnRecord.return_number}*\n` +
      `Status: ${returnRecord.status}\n` +
      `Customer: ${returnRecord.customers?.company_name || 'Direct Customer'}\n` +
      `Resolution: ${returnRecord.resolution_type}\n` +
      `Total Value: ₹${Number(returnRecord.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      `Date: ${new Date(returnRecord.return_date).toLocaleDateString('en-IN')}\n\n` +
      `*Returned Items:*\n` +
      lines
        .map(
          l =>
            `• ${l.quantity_returned} ${l.products?.unit || 'units'} x ${l.products?.name} [${l.condition}]`
        )
        .join('\n')
  );

  return (
    <PageContainer>
      <PageHeader
        title={returnRecord.return_number}
        description={`Customer return shipment received on ${new Date(returnRecord.return_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        backHref="/customer-returns"
        badge={getStatusBadge(returnRecord.status)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!returnRecord.is_restocked && returnRecord.status !== 'Rejected' && goodUnits > 0 && (
              <Button
                variant="success"
                size="sm"
                onClick={handleRestockInventory}
                disabled={actionLoading}
                className="h-8 gap-1.5 text-xs shadow-xs"
              >
                {actionLoading ? (
                  <Icons.refresh className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Icons.in className="w-3.5 h-3.5" />
                )}
                Restock Salable Stock ({goodUnits})
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

            {/* Workflow Status Dropdown / Controls */}
            {returnRecord.status === 'Pending' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateStatus('Approved')}
                disabled={actionLoading}
                className="h-8 gap-1.5 text-xs"
              >
                <Icons.check className="w-3.5 h-3.5 text-blue-600" /> Approve
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

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Customer & Origin Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.customers className="w-4 h-4 text-primary" /> Customer & Billing Origin
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Customer Account:</span>
              <span className="font-semibold text-foreground">
                {returnRecord.customers?.company_name || 'Direct Customer (Unlinked)'}
              </span>
            </div>
            {returnRecord.customers?.phone && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Phone Contact:</span>
                <span className="font-medium text-foreground">{returnRecord.customers.phone}</span>
              </div>
            )}
            {returnRecord.customers?.email && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium text-foreground">{returnRecord.customers.email}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border/60">
              <span className="text-muted-foreground">Original Invoice Ref:</span>
              <span className="font-medium text-foreground">
                {returnRecord.original_invoice_number ? (
                  <span className="font-mono text-xs bg-muted/80 text-foreground px-2 py-0.5 rounded border border-border/60">
                    {returnRecord.original_invoice_number}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs italic">Not Provided</span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Reverse Logistics & Resolution Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Icons.returns className="w-4 h-4 text-primary" /> Resolution & Warehouse Audit
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
              <span className="text-muted-foreground">Return Date:</span>
              <span className="font-medium text-foreground">
                {new Date(returnRecord.return_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border/60">
              <span className="text-muted-foreground">Inventory Restock Status:</span>
              <span>
                {returnRecord.is_restocked ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                    <Icons.check className="w-3.5 h-3.5" />
                    Restocked on{' '}
                    {returnRecord.restocked_at
                      ? new Date(returnRecord.restocked_at).toLocaleDateString('en-IN')
                      : 'Yes'}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">
                    Pending Warehouse Credit
                  </span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Returned Line Items Table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Icons.products className="w-4 h-4 text-primary" /> Returned Line Items ({lines.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Physical items received and inspected for resale or defect quarantine
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-muted/60 border-y border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Product Name</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3 text-right">Qty Returned</th>
                <th className="px-5 py-3 text-right">Unit Price</th>
                <th className="px-5 py-3 text-center">Physical Condition</th>
                <th className="px-5 py-3">Return Reason / Notes</th>
                <th className="px-5 py-3 text-right">Line Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {lines.map(line => {
                const lineTotal =
                  (Number(line.quantity_returned) || 0) * (Number(line.unit_price) || 0);

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
                            Active Stock: {line.products.current_stock} {line.products.unit}
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
                      ₹{Number(line.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-center">{getConditionBadge(line.condition)}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      {line.return_reason || <span className="italic">—</span>}
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

        {/* Valuation & Inspection Breakdown */}
        <div className="p-4 sm:p-6 bg-muted/20 border-t border-border/60 flex flex-col items-end space-y-1.5 text-xs sm:text-sm">
          <div className="flex justify-between w-full max-w-sm text-muted-foreground">
            <span>Total Units Returned:</span>
            <span className="font-mono font-medium text-foreground">{totalUnits} units</span>
          </div>
          <div className="flex justify-between w-full max-w-sm text-muted-foreground">
            <span>Salable Stock (&apos;Good&apos;):</span>
            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
              {goodUnits} units
            </span>
          </div>
          {damagedOrDefectiveUnits > 0 && (
            <div className="flex justify-between w-full max-w-sm text-muted-foreground">
              <span>Quarantined Stock (Damaged/Defective):</span>
              <span className="font-mono font-medium text-amber-600 dark:text-amber-400">
                {damagedOrDefectiveUnits} units
              </span>
            </div>
          )}
          <div className="flex justify-between w-full max-w-sm pt-2 border-t border-border text-base font-bold text-foreground">
            <span>Total Return Valuation:</span>
            <span className="font-mono text-primary">
              ₹
              {Number(returnRecord.total_amount || totalCalculatedValue).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </Card>

      {/* Inspection Remarks Card */}
      {returnRecord.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Inspection Remarks & Settlement Notes
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
