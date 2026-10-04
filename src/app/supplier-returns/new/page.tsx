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

interface Supplier {
  id: string;
  company_name: string;
  phone?: string;
  contact_person?: string;
}

interface Product {
  id: string;
  name: string;
  sku_code: string;
  unit: string;
  price_non_gst: number;
  price_gst: number;
  current_stock: number;
  default_supplier_id?: string;
}

interface PurchaseOrderSummary {
  id: string;
  po_number: string;
  order_date: string;
}

interface ReturnLineItem {
  product_id: string;
  quantity_returned: number;
  unit_cost: number;
  return_reason: string;
}

const COMMON_REASONS = [
  'Defective / Quality Failure',
  'Damaged in Transit',
  'Wrong Item Supplied',
  'Excess / Over-shipment',
  'Expired / Near Expiry',
  'Specification Mismatch',
  'Other',
];

function NewSupplierReturnForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierIdParam = searchParams.get('supplier_id');
  const poParam = searchParams.get('po_number');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierPOs, setSupplierPOs] = useState<PurchaseOrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    return_number: 'Generating...',
    supplier_id: supplierIdParam || '',
    original_po_number: poParam || '',
    return_date: new Date().toISOString().split('T')[0],
    resolution_type: 'Credit Note' as 'Replacement' | 'Refund' | 'Credit Note',
    status: 'Pending' as 'Draft' | 'Pending' | 'Shipped',
    notes: '',
    auto_deduct_stock: true,
  });

  const [lines, setLines] = useState<ReturnLineItem[]>([
    { product_id: '', quantity_returned: 1, unit_cost: 0, return_reason: 'Defective / Quality Failure' },
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const [suppliersRes, productsRes, lastReturnRes] = await Promise.all([
          supabase.from('suppliers').select('id, company_name, phone, contact_person').eq('is_deleted', false).order('company_name'),
          supabase.from('products').select('id, name, sku_code, unit, price_non_gst, price_gst, current_stock, default_supplier_id').eq('is_deleted', false).order('name'),
          supabase.from('supplier_returns').select('return_number').not('return_number', 'is', null).order('return_number', { ascending: false }).limit(1),
        ]);

        if (suppliersRes.error) throw suppliersRes.error;
        if (productsRes.error) throw productsRes.error;

        setSuppliers(suppliersRes.data || []);
        setProducts(productsRes.data || []);

        // Generate sequential Return Number: SR-0001
        if (lastReturnRes.data && lastReturnRes.data.length > 0 && lastReturnRes.data[0].return_number) {
          const lastNumStr = lastReturnRes.data[0].return_number;
          const match = lastNumStr.match(/SR-(\d+)/);
          if (match && match[1]) {
            const nextNum = parseInt(match[1], 10) + 1;
            setFormData(prev => ({ ...prev, return_number: `SR-${String(nextNum).padStart(4, '0')}` }));
          } else {
            setFormData(prev => ({ ...prev, return_number: `SR-${Date.now().toString().slice(-4)}` }));
          }
        } else {
          setFormData(prev => ({ ...prev, return_number: 'SR-0001' }));
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load initial data');
      } finally {
        setFetching(false);
      }
    }

    loadData();
  }, []);

  // When supplier changes, fetch their recent POs for optional selection
  useEffect(() => {
    if (!formData.supplier_id) {
      setSupplierPOs([]);
      return;
    }

    async function loadSupplierPOs() {
      try {
        const { data, error: poErr } = await supabase
          .from('purchase_orders')
          .select('id, po_number, order_date')
          .eq('supplier_id', formData.supplier_id)
          .eq('is_deleted', false)
          .order('order_date', { ascending: false })
          .limit(10);

        if (!poErr && data) {
          setSupplierPOs(data);
        }
      } catch (e) {
        // Non-blocking
      }
    }

    loadSupplierPOs();
  }, [formData.supplier_id]);

  const handleProductChange = (index: number, productId: string) => {
    const selectedProd = products.find(p => p.id === productId);
    const updated = [...lines];
    if (selectedProd) {
      const unitCost = Number(selectedProd.price_non_gst) || Number(selectedProd.price_gst) || 0;
      updated[index] = {
        ...updated[index],
        product_id: productId,
        unit_cost: unitCost,
      };
    } else {
      updated[index].product_id = '';
      updated[index].unit_cost = 0;
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
      { product_id: '', quantity_returned: 1, unit_cost: 0, return_reason: 'Defective / Quality Failure' },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) {
      alert('Return note must contain at least one line item.');
      return;
    }
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const totalAmount = lines.reduce((acc, line) => {
    const q = Number(line.quantity_returned) || 0;
    const c = Number(line.unit_cost) || 0;
    return acc + q * c;
  }, 0);

  const totalUnits = lines.reduce((acc, line) => acc + (Number(line.quantity_returned) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier_id) {
      alert('Please select a supplier.');
      return;
    }

    // Validation
    const invalidLines = lines.filter(l => !l.product_id || Number(l.quantity_returned) <= 0);
    if (invalidLines.length > 0) {
      alert('Please select a valid product and enter a positive return quantity for all rows.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Insert into supplier_returns
      const isStockDeducted = formData.auto_deduct_stock;
      const initialStatus = isStockDeducted ? 'Shipped' : formData.status;

      const { data: returnData, error: returnError } = await supabase
        .from('supplier_returns')
        .insert([
          {
            return_number: formData.return_number,
            supplier_id: formData.supplier_id,
            original_po_number: formData.original_po_number || null,
            return_date: formData.return_date,
            resolution_type: formData.resolution_type,
            notes: formData.notes || null,
            status: initialStatus,
            total_amount: totalAmount,
            is_stock_deducted: isStockDeducted,
            stock_deducted_at: isStockDeducted ? new Date().toISOString() : null,
          },
        ])
        .select()
        .single();

      if (returnError) throw returnError;

      // 2. Insert into supplier_return_lines (omitting generated total_amount)
      const linesToInsert = lines.map(line => ({
        supplier_return_id: returnData.id,
        product_id: line.product_id,
        quantity_returned: Number(line.quantity_returned),
        unit_cost: Number(line.unit_cost),
        return_reason: line.return_reason || null,
      }));

      const { error: linesError } = await supabase
        .from('supplier_return_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;

      // 3. If auto_deduct_stock is enabled, execute reverse logistics inventory deduction
      if (isStockDeducted) {
        for (const line of lines) {
          const { data: prodData, error: prodError } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', line.product_id)
            .single();

          if (prodError) throw prodError;

          const currentStock = Number(prodData?.current_stock) || 0;
          const newStock = Math.max(0, currentStock - Number(line.quantity_returned));

          const { error: updateStockError } = await supabase
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', line.product_id);

          if (updateStockError) throw updateStockError;

          // Record audit log in stock_adjustments
          const { error: adjError } = await supabase
            .from('stock_adjustments')
            .insert([
              {
                product_id: line.product_id,
                adjustment_type: 'Out',
                quantity: Number(line.quantity_returned),
                reason: `Supplier Return: ${returnData.return_number}`,
                reference_type: 'Supplier Return',
                reference_id: returnData.id,
              },
            ]);

          if (adjError) throw adjError;
        }
      }

      router.push(`/supplier-returns/${returnData.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create supplier return');
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <PageContainer>
        <div className="py-24 text-center">
          <Icons.refresh className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-muted-foreground text-sm">Loading suppliers and inventory master data...</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="New Supplier Return"
        description="Initiate a purchase return to a supplier with condition grading, debit notes, and inventory deduction."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/supplier-returns">
              <Icons.back className="w-4 h-4 mr-2" />
              Back to Returns
            </Link>
          </Button>
        }
      />

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
          <Icons.warning className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Return Intake Form (2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-xs border-border/70">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">Vendor & Return Details</CardTitle>
                <CardDescription className="text-xs">
                  Specify the supplier, reference purchase order, and settlement resolution.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Return Number <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.return_number}
                      onChange={e => setFormData({ ...formData, return_number: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm font-mono bg-muted/30 border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Return Date <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.return_date}
                      onChange={e => setFormData({ ...formData, return_date: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Supplier <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={formData.supplier_id}
                      onChange={e => setFormData({ ...formData, supplier_id: e.target.value, original_po_number: '' })}
                      required
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select a Supplier...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.company_name} {s.phone ? `(${s.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Original PO # <span className="text-[11px] font-normal text-muted-foreground">(Optional)</span>
                    </label>
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={formData.original_po_number}
                        onChange={e => setFormData({ ...formData, original_po_number: e.target.value })}
                        placeholder="e.g. PO-0012"
                        className="w-full px-3 py-2 text-sm font-mono bg-background border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary"
                      />
                      {supplierPOs.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                          <span>Recent POs:</span>
                          {supplierPOs.map(po => (
                            <button
                              type="button"
                              key={po.id}
                              onClick={() => setFormData({ ...formData, original_po_number: po.po_number })}
                              className="px-1.5 py-0.5 rounded bg-muted hover:bg-primary/10 hover:text-primary font-mono text-[10px] transition-colors"
                            >
                              {po.po_number}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Resolution Type <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={formData.resolution_type}
                      onChange={e => setFormData({ ...formData, resolution_type: e.target.value as any })}
                      required
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary"
                    >
                      <option value="Credit Note">Credit Note (Debit from vendor balance)</option>
                      <option value="Replacement">Replacement (Expect new goods)</option>
                      <option value="Refund">Refund (Bank / Cash payout)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Initial Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary"
                      disabled={formData.auto_deduct_stock}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Pending">Pending Dispatch</option>
                      <option value="Shipped">Shipped / Dispatched</option>
                    </select>
                    {formData.auto_deduct_stock && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Status is auto-set to <strong>Shipped</strong> when auto-deducting stock.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Notes & Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Enter transport details, courier docket #, or reason for return..."
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Line Items Table */}
            <Card className="shadow-xs border-border/70 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/20 border-b">
                <div>
                  <CardTitle className="text-base font-semibold">Returned Line Items</CardTitle>
                  <CardDescription className="text-xs">
                    Select warehouse products and enter quantities to return back to supplier.
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Icons.add className="w-3.5 h-3.5 mr-1" />
                  Add Product Line
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 border-b text-xs text-muted-foreground font-medium">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Product / Available Stock</th>
                        <th className="py-2.5 px-3 w-28 text-right">Return Qty</th>
                        <th className="py-2.5 px-3 w-32 text-right">Unit Cost (₹)</th>
                        <th className="py-2.5 px-3 w-36">Return Reason</th>
                        <th className="py-2.5 px-3 w-32 text-right">Total (₹)</th>
                        <th className="py-2.5 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {lines.map((line, index) => {
                        const selectedProd = products.find(p => p.id === line.product_id);
                        const lineTotal = (Number(line.quantity_returned) || 0) * (Number(line.unit_cost) || 0);
                        const isOverStock = selectedProd && Number(line.quantity_returned) > Number(selectedProd.current_stock);

                        return (
                          <tr key={index} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-3 text-center text-xs text-muted-foreground font-mono">
                              {index + 1}
                            </td>
                            <td className="py-3 px-3">
                              <select
                                value={line.product_id}
                                onChange={e => handleProductChange(index, e.target.value)}
                                required
                                className="w-full px-2.5 py-1.5 text-xs bg-background border rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary mb-1"
                              >
                                <option value="">Select Product...</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.sku_code || 'No SKU'}) — Stock: {p.current_stock} {p.unit}
                                  </option>
                                ))}
                              </select>
                              {selectedProd && (
                                <div className="flex items-center gap-2 text-[11px]">
                                  <span className="text-muted-foreground font-mono">
                                    SKU: {selectedProd.sku_code || 'N/A'}
                                  </span>
                                  <span className="text-muted-foreground">•</span>
                                  <span
                                    className={`font-semibold ${
                                      selectedProd.current_stock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                                    }`}
                                  >
                                    Available: {selectedProd.current_stock} {selectedProd.unit}
                                  </span>
                                  {isOverStock && (
                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                      ⚠️ Exceeds stock
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={line.quantity_returned}
                                onChange={e => handleLineChange(index, 'quantity_returned', e.target.value)}
                                required
                                className="w-full px-2 py-1.5 text-xs text-right font-mono bg-background border rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary"
                              />
                            </td>
                            <td className="py-3 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.unit_cost}
                                onChange={e => handleLineChange(index, 'unit_cost', e.target.value)}
                                required
                                className="w-full px-2 py-1.5 text-xs text-right font-mono bg-background border rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <select
                                value={line.return_reason}
                                onChange={e => handleLineChange(index, 'return_reason', e.target.value)}
                                className="w-full px-2 py-1.5 text-xs bg-background border rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary"
                              >
                                {COMMON_REASONS.map(r => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-foreground text-xs whitespace-nowrap">
                              ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeLine(index)}
                                className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                                title="Remove Line"
                              >
                                <Icons.trash className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Rail: Financial Summary & Stock Logistics */}
          <div className="space-y-6">
            <Card className="shadow-xs border-border/70 sticky top-20">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-semibold">Debit Note Summary</CardTitle>
                <CardDescription className="text-xs">
                  Summary of units returning to supplier and reverse inventory settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Product Lines</span>
                    <span className="font-semibold font-mono">{lines.length}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Total Returned Units</span>
                    <span className="font-semibold font-mono">{totalUnits}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Resolution</span>
                    <Badge variant="outline" className="font-medium text-xs">
                      {formData.resolution_type}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-2 text-base font-bold text-foreground">
                    <span>Total Debit Amount</span>
                    <span className="text-primary font-mono">
                      ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Auto Deduct Inventory Toggle */}
                <div className="p-3.5 rounded-xl border bg-muted/30 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.auto_deduct_stock}
                      onChange={e => setFormData({ ...formData, auto_deduct_stock: e.target.checked })}
                      className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-foreground block">
                        Deduct items from stock immediately
                      </span>
                      <span className="text-muted-foreground text-[11px] leading-relaxed block mt-0.5">
                        Immediately decreases warehouse stock levels and generates &apos;Out&apos; audit entries in stock adjustments.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="pt-2 space-y-2">
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Icons.refresh className="w-4 h-4 mr-2 animate-spin" />
                        Creating Return Note...
                      </>
                    ) : (
                      <>
                        <Icons.check className="w-4 h-4 mr-2" />
                        Generate Supplier Return
                      </>
                    )}
                  </Button>
                  <Button variant="outline" type="button" asChild className="w-full">
                    <Link href="/supplier-returns">Cancel</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </PageContainer>
  );
}

export default function NewSupplierReturnPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <div className="py-24 text-center">
            <Icons.refresh className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
            <p className="text-muted-foreground text-sm">Preparing return form...</p>
          </div>
        </PageContainer>
      }
    >
      <NewSupplierReturnForm />
    </Suspense>
  );
}
