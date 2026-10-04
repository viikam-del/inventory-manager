'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

interface Customer {
  id: string;
  company_name: string;
  phone?: string;
}

interface Product {
  id: string;
  name: string;
  sku_code: string;
  unit: string;
  price_non_gst: number;
  price_gst: number;
  current_stock: number;
}

interface ReturnLineItem {
  product_id: string;
  quantity_returned: number;
  unit_price: number;
  condition: 'Good' | 'Damaged' | 'Defective';
  return_reason: string;
}

function NewCustomerReturnForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get('customer_id');
  const invoiceParam = searchParams.get('invoice_no');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    return_number: 'Generating...',
    customer_id: customerIdParam || '',
    original_invoice_number: invoiceParam || '',
    return_date: new Date().toISOString().split('T')[0],
    resolution_type: 'Credit Note' as 'Replacement' | 'Refund' | 'Credit Note',
    status: 'Pending' as 'Pending' | 'Approved' | 'Completed',
    notes: '',
    auto_restock_good: false,
  });

  const [lines, setLines] = useState<ReturnLineItem[]>([
    { product_id: '', quantity_returned: 1, unit_price: 0, condition: 'Good', return_reason: '' },
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const [customersRes, productsRes, lastReturnRes] = await Promise.all([
          supabase.from('customers').select('id, company_name, phone').eq('is_deleted', false).order('company_name'),
          supabase.from('products').select('id, name, sku_code, unit, price_non_gst, price_gst, current_stock').eq('is_deleted', false).order('name'),
          supabase.from('customer_returns').select('return_number').not('return_number', 'is', null).order('return_number', { ascending: false }).limit(1),
        ]);

        if (customersRes.error) throw customersRes.error;
        if (productsRes.error) throw productsRes.error;

        setCustomers(customersRes.data || []);
        setProducts(productsRes.data || []);

        // Generate sequential Return Number
        if (lastReturnRes.data && lastReturnRes.data.length > 0 && lastReturnRes.data[0].return_number) {
          const lastNumStr = lastReturnRes.data[0].return_number;
          const match = lastNumStr.match(/RET-(\d+)/);
          if (match && match[1]) {
            const nextNum = parseInt(match[1], 10) + 1;
            setFormData(prev => ({ ...prev, return_number: `RET-${String(nextNum).padStart(4, '0')}` }));
          } else {
            setFormData(prev => ({ ...prev, return_number: `RET-${Date.now().toString().slice(-4)}` }));
          }
        } else {
          setFormData(prev => ({ ...prev, return_number: 'RET-0001' }));
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load initial data');
      } finally {
        setFetching(false);
      }
    }

    loadData();
  }, []);

  const handleProductChange = (index: number, productId: string) => {
    const selectedProd = products.find(p => p.id === productId);
    const updated = [...lines];
    if (selectedProd) {
      const unitPrice = Number(selectedProd.price_non_gst) || Number(selectedProd.price_gst) || 0;
      updated[index] = {
        ...updated[index],
        product_id: productId,
        unit_price: unitPrice,
      };
    } else {
      updated[index].product_id = '';
      updated[index].unit_price = 0;
    }
    setLines(updated);
  };

  const handleLineChange = (index: number, field: keyof ReturnLineItem, value: any) => {
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setLines(updated);
  };

  const addLine = () => {
    setLines(prev => [
      ...prev,
      { product_id: '', quantity_returned: 1, unit_price: 0, condition: 'Good', return_reason: '' },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const totalReturnValue = lines.reduce(
    (acc, l) => acc + (Number(l.quantity_returned) || 0) * (Number(l.unit_price) || 0),
    0
  );

  const goodConditionCount = lines
    .filter(l => l.condition === 'Good' && l.product_id)
    .reduce((acc, l) => acc + (Number(l.quantity_returned) || 0), 0);

  const nonRestockableCount = lines
    .filter(l => l.condition !== 'Good' && l.product_id)
    .reduce((acc, l) => acc + (Number(l.quantity_returned) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.customer_id) {
      setError('Please select a customer for this return.');
      return;
    }

    const validLines = lines.filter(l => l.product_id && Number(l.quantity_returned) > 0);
    if (validLines.length === 0) {
      setError('Please add at least one valid product line with quantity > 0.');
      return;
    }

    setLoading(true);

    try {
      const willRestockNow = formData.auto_restock_good && goodConditionCount > 0;
      const initialStatus = willRestockNow ? 'Completed' : formData.status;

      // 1. Insert customer return header
      const { data: returnData, error: returnError } = await supabase
        .from('customer_returns')
        .insert([
          {
            return_number: formData.return_number,
            customer_id: formData.customer_id,
            original_invoice_number: formData.original_invoice_number.trim() || null,
            return_date: formData.return_date,
            resolution_type: formData.resolution_type,
            notes: formData.notes.trim() || null,
            status: initialStatus,
            total_amount: totalReturnValue,
            is_restocked: willRestockNow,
            restocked_at: willRestockNow ? new Date().toISOString() : null,
          },
        ])
        .select()
        .single();

      if (returnError) throw returnError;

      // 2. Insert line items
      const linesToInsert = validLines.map(line => ({
        customer_return_id: returnData.id,
        product_id: line.product_id,
        quantity_returned: Number(line.quantity_returned),
        unit_price: Number(line.unit_price),
        total_amount: Number(line.quantity_returned) * Number(line.unit_price),
        condition: line.condition,
        return_reason: line.return_reason.trim() || null,
      }));

      const { error: linesError } = await supabase
        .from('customer_return_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;

      // 3. Process immediate stock restocking if requested
      if (willRestockNow) {
        for (const line of validLines) {
          if (line.condition === 'Good' && Number(line.quantity_returned) > 0) {
            // Fetch current stock
            const { data: prodData } = await supabase
              .from('products')
              .select('current_stock')
              .eq('id', line.product_id)
              .single();

            const currentStock = Number(prodData?.current_stock) || 0;
            const newStock = currentStock + Number(line.quantity_returned);

            // Update product stock
            await supabase
              .from('products')
              .update({ current_stock: newStock })
              .eq('id', line.product_id);

            // Audit record in stock_adjustments
            await supabase
              .from('stock_adjustments')
              .insert([
                {
                  product_id: line.product_id,
                  adjustment_type: 'In',
                  quantity: Number(line.quantity_returned),
                  reason: `Customer Return: ${returnData.return_number}`,
                  reference_type: 'Customer Return',
                  reference_id: returnData.id,
                },
              ]);
          }
        }
      }

      router.push(`/customer-returns/${returnData.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to record customer return');
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Preparing return creation form...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Record Customer Return"
        description="Process inbound customer return items, grade physical conditions, choose compensation resolution, and update stock"
        backHref="/customer-returns"
        badge={
          <Badge variant="secondary" className="font-mono text-[11px]">
            {formData.return_number}
          </Badge>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Card className="border-destructive/30 bg-destructive/5 text-destructive p-4">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Icons.warning className="w-4 h-4 shrink-0" />
              {error}
            </div>
          </Card>
        )}

        {/* Header Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Icons.returns className="w-4 h-4 text-primary" /> Return Shipment Details
            </CardTitle>
            <CardDescription className="text-xs">
              Identify the originating customer, original sale invoice reference, and settlement preference
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Return ID <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.return_number}
                  onChange={e => setFormData({ ...formData, return_number: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Customer <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.customer_id}
                  onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select Customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Return Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={formData.return_date}
                  onChange={e => setFormData({ ...formData, return_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Original Invoice / Bill #
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2025-0012"
                  value={formData.original_invoice_number}
                  onChange={e => setFormData({ ...formData, original_invoice_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Resolution Preference <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.resolution_type}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      resolution_type: e.target.value as 'Replacement' | 'Refund' | 'Credit Note',
                    })
                  }
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="Credit Note">Credit Note (Store Balance)</option>
                  <option value="Refund">Direct Refund (Cash/UPI/Bank)</option>
                  <option value="Replacement">Physical Item Replacement</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Initial Workflow Status
                </label>
                <select
                  value={formData.status}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      status: e.target.value as 'Pending' | 'Approved' | 'Completed',
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="Pending">Pending (Inspection in progress)</option>
                  <option value="Approved">Approved (Verified by manager)</option>
                  <option value="Completed">Completed (Finalized)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Return Items Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Icons.products className="w-4 h-4 text-primary" /> Returned Line Items
              </CardTitle>
              <CardDescription className="text-xs">
                Inspect and grade each product condition. Only items marked &apos;Good&apos; qualify for live inventory restock.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
              className="h-8 gap-1.5 text-xs"
            >
              <Icons.add className="w-3.5 h-3.5" />
              Add Product
            </Button>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/50 border-y sm:border-y-0 sm:border-b border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5 min-w-[220px]">Product</th>
                    <th className="px-3 py-2.5 w-24">Qty Ret.</th>
                    <th className="px-3 py-2.5 w-28">Unit Price (₹)</th>
                    <th className="px-3 py-2.5 w-32">Condition</th>
                    <th className="px-3 py-2.5 min-w-[180px]">Return Reason</th>
                    <th className="px-4 py-2.5 w-28 text-right">Line Total</th>
                    <th className="px-2 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {lines.map((line, idx) => {
                    const lineTotal = (Number(line.quantity_returned) || 0) * (Number(line.unit_price) || 0);
                    const selectedProduct = products.find(p => p.id === line.product_id);

                    return (
                      <tr key={idx} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <select
                            value={line.product_id}
                            onChange={e => handleProductChange(idx, e.target.value)}
                            required
                            className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">Select Product...</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.sku_code ? `[${p.sku_code}]` : ''} (Stock: {p.current_stock} {p.unit})
                              </option>
                            ))}
                          </select>
                          {selectedProduct && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Current Warehouse Stock: {selectedProduct.current_stock} {selectedProduct.unit}
                            </p>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={line.quantity_returned}
                            onChange={e => handleLineChange(idx, 'quantity_returned', parseFloat(e.target.value) || 0)}
                            required
                            className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-foreground text-xs sm:text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unit_price}
                            onChange={e => handleLineChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            required
                            className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </td>

                        <td className="px-3 py-3">
                          <select
                            value={line.condition}
                            onChange={e =>
                              handleLineChange(
                                idx,
                                'condition',
                                e.target.value as 'Good' | 'Damaged' | 'Defective'
                              )
                            }
                            className={`w-full px-2 py-1.5 rounded-md border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring ${
                              line.condition === 'Good'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                : line.condition === 'Damaged'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : 'bg-destructive/10 text-destructive border-destructive/30'
                            }`}
                          >
                            <option value="Good">Good (Salable)</option>
                            <option value="Damaged">Damaged (Packaging)</option>
                            <option value="Defective">Defective (Faulty)</option>
                          </select>
                        </td>

                        <td className="px-3 py-3">
                          <input
                            type="text"
                            placeholder="e.g. Wrong SKU shipped, seal broken, defect"
                            value={line.return_reason}
                            onChange={e => handleLineChange(idx, 'return_reason', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-semibold text-foreground whitespace-nowrap">
                          ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={lines.length === 1}
                            className="text-muted-foreground hover:text-destructive disabled:opacity-20 transition-colors p-1"
                            title="Remove row"
                          >
                            <Icons.close className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial & Item Inspection Summary */}
            <div className="border-t border-border/60 p-4 sm:p-6 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs sm:text-sm">
              <div className="space-y-1 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span>Restockable (&apos;Good&apos; condition):</span>
                  <strong className="text-foreground">{goodConditionCount} units</strong>
                </div>
                {nonRestockableCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    <span>Damaged / Defective (Quarantined):</span>
                    <strong className="text-amber-600 dark:text-amber-400">{nonRestockableCount} units</strong>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end space-y-1 w-full sm:w-auto">
                <div className="flex justify-between sm:justify-end gap-6 text-muted-foreground w-full">
                  <span>Total Line Items:</span>
                  <span className="font-semibold text-foreground">{lines.length}</span>
                </div>
                <div className="flex justify-between sm:justify-end gap-6 text-base font-bold text-foreground border-t border-border pt-1.5 w-full">
                  <span>Total Return Value:</span>
                  <span className="font-mono text-primary">
                    ₹{totalReturnValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Immediate Restock Option & Remarks Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inspection Notes & Inventory Restock Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3.5 rounded-lg border border-border/70 bg-card flex items-start gap-3">
              <input
                type="checkbox"
                id="auto_restock_good"
                checked={formData.auto_restock_good}
                onChange={e => setFormData({ ...formData, auto_restock_good: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              <label htmlFor="auto_restock_good" className="text-xs sm:text-sm cursor-pointer space-y-0.5">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Icons.in className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Automatically restock &apos;Good&apos; condition items into warehouse inventory immediately
                </span>
                <p className="text-xs text-muted-foreground">
                  If selected, all items in &apos;Good&apos; condition ({goodConditionCount} units) will be credited to live inventory stock upon saving,
                  a stock adjustment audit record will be logged, and this return will be marked as Completed.
                </p>
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Inspection Remarks & Settlement Notes
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g. Customer brought package into storefront. Verified invoice copy. Store credit voucher issued on spot..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" asChild>
            <Link href="/customer-returns">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading} className="gap-1.5">
            {loading ? (
              <>
                <Icons.refresh className="w-3.5 h-3.5 animate-spin" />
                Recording Return...
              </>
            ) : (
              <>
                <Icons.save className="w-3.5 h-3.5" />
                Save Customer Return
              </>
            )}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

export default function NewCustomerReturnPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <div className="min-h-[50vh] flex items-center justify-center">
            <div className="text-center space-y-3">
              <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                Loading return form...
              </p>
            </div>
          </div>
        </PageContainer>
      }
    >
      <NewCustomerReturnForm />
    </Suspense>
  );
}
