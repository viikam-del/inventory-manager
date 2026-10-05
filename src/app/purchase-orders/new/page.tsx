'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  default_credit_days: number;
}

interface Product {
  id: string;
  name: string;
  sku_code: string;
  unit: string;
  gst_rate: number;
  price_gst: number;
  price_non_gst: number;
}

interface POLineItem {
  product_id: string;
  quantity: number;
  unit_cost: number;
  billed_rate: number;
  cash_rate: number;
  billing_mode: 'billed' | 'cash' | 'split';
  gst_rate: number;
  gst_amount: number;
  is_billed: boolean;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    po_number: 'Generating...',
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    delivery_charges: 0,
    notes: '',
  });

  const [lines, setLines] = useState<POLineItem[]>([
    { product_id: '', quantity: 1, unit_cost: 0, billed_rate: 0, cash_rate: 0, billing_mode: 'billed', gst_rate: 18, gst_amount: 0, is_billed: true }
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const [suppliersRes, productsRes, lastPORes] = await Promise.all([
          supabase.from('suppliers').select('id, company_name, default_credit_days').eq('is_deleted', false).order('company_name'),
          supabase.from('products').select('id, name, sku_code, unit, gst_rate, price_gst, price_non_gst').eq('is_deleted', false).order('name'),
          supabase.from('purchase_orders').select('po_number').eq('is_deleted', false).not('po_number', 'is', null)
        ]);

        if (suppliersRes.error) throw suppliersRes.error;
        if (productsRes.error) throw productsRes.error;

        setSuppliers(suppliersRes.data || []);
        setProducts(productsRes.data || []);

        // Generate sequential PO number based on maximum active PO number
        let maxNum = 0;
        if (lastPORes.data && lastPORes.data.length > 0) {
          for (const row of lastPORes.data) {
            if (row.po_number && !row.po_number.includes('-DEL-')) {
              const match = row.po_number.match(/PO-(\d+)/i);
              if (match && match[1]) {
                const val = parseInt(match[1], 10);
                if (!isNaN(val) && val > maxNum) {
                  maxNum = val;
                }
              }
            }
          }
        }
        const nextNum = maxNum + 1;
        setFormData(prev => ({ ...prev, po_number: `PO-${String(nextNum).padStart(4, '0')}` }));
      } catch (err: any) {
        setError(err.message || 'Failed to load suppliers or products');
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
      const unitCost = Number(selectedProd.price_non_gst) || 0;
      const gstRate = Number(selectedProd.gst_rate) || 18;
      const qty = updated[index].quantity || 1;
      const mode = updated[index].billing_mode || 'billed';

      let billedRate = 0;
      let cashRate = 0;
      let isBilled = true;

      if (mode === 'billed') {
        billedRate = unitCost;
        cashRate = 0;
        isBilled = true;
      } else if (mode === 'cash') {
        billedRate = 0;
        cashRate = unitCost;
        isBilled = false;
      } else {
        // split mode: keep existing split or default 50/50
        billedRate = Number((unitCost / 2).toFixed(2));
        cashRate = Number((unitCost - billedRate).toFixed(2));
        isBilled = true;
      }

      const effectiveUnitCost = billedRate + cashRate;
      const gstAmt = isBilled && billedRate > 0 ? (qty * billedRate * gstRate) / 100 : 0;

      updated[index] = {
        product_id: productId,
        quantity: qty,
        unit_cost: effectiveUnitCost,
        billed_rate: billedRate,
        cash_rate: cashRate,
        billing_mode: mode,
        gst_rate: gstRate,
        gst_amount: Number(gstAmt.toFixed(2)),
        is_billed: isBilled
      };
    } else {
      updated[index].product_id = '';
    }
    setLines(updated);
  };

  const handleLineChange = (index: number, field: keyof POLineItem, value: any) => {
    const updated = [...lines];
    const current = { ...updated[index], [field]: value };

    if (field === 'billing_mode') {
      const mode = value as 'billed' | 'cash' | 'split';
      const totalCost = current.unit_cost || (current.billed_rate + current.cash_rate) || 0;

      if (mode === 'billed') {
        current.billed_rate = totalCost > 0 ? totalCost : current.billed_rate;
        current.cash_rate = 0;
        current.is_billed = true;
      } else if (mode === 'cash') {
        current.cash_rate = totalCost > 0 ? totalCost : current.cash_rate;
        current.billed_rate = 0;
        current.is_billed = false;
      } else if (mode === 'split') {
        current.is_billed = true;
        if (current.billed_rate === 0 && current.cash_rate === 0 && totalCost > 0) {
          current.billed_rate = Number((totalCost / 2).toFixed(2));
          current.cash_rate = Number((totalCost - current.billed_rate).toFixed(2));
        }
      }
      current.billing_mode = mode;
    }

    const qty = Number(current.quantity) || 0;
    const billedRate = Number(current.billed_rate) || 0;
    const cashRate = Number(current.cash_rate) || 0;
    const gstRate = Number(current.gst_rate) || 0;

    current.unit_cost = billedRate + cashRate;
    current.is_billed = billedRate > 0 || current.billing_mode !== 'cash';

    if (current.is_billed && billedRate > 0) {
      current.gst_amount = Number(((qty * billedRate * gstRate) / 100).toFixed(2));
    } else {
      current.gst_amount = 0;
    }

    updated[index] = current;
    setLines(updated);
  };

  const addLine = () => {
    setLines(prev => [...prev, { product_id: '', quantity: 1, unit_cost: 0, billed_rate: 0, cash_rate: 0, billing_mode: 'billed', gst_rate: 18, gst_amount: 0, is_billed: true }]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return lines.reduce((acc, l) => acc + (l.quantity * (l.billed_rate + l.cash_rate)), 0);
  };

  const calculateBilledSubtotal = () => {
    return lines.reduce((acc, l) => acc + (l.quantity * (Number(l.billed_rate) || 0)), 0);
  };

  const calculateCashSubtotal = () => {
    return lines.reduce((acc, l) => acc + (l.quantity * (Number(l.cash_rate) || 0)), 0);
  };

  const calculateTotalGST = () => {
    return lines.reduce((acc, l) => acc + (l.gst_amount || 0), 0);
  };

  const calculateTotalBilledInvoice = () => {
    return calculateBilledSubtotal() + calculateTotalGST();
  };

  const calculateGrandTotal = () => {
    return calculateSubtotal() + calculateTotalGST() + Number(formData.delivery_charges || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.supplier_id) {
      setError('Please select a supplier');
      return;
    }

    const validLines = lines.filter(l => l.product_id && l.quantity > 0);
    if (validLines.length === 0) {
      setError('Please add at least one valid product line');
      return;
    }

    setLoading(true);

    try {
      // 1. Insert Purchase Order
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert([{
          po_number: formData.po_number,
          supplier_id: formData.supplier_id,
          order_date: formData.order_date,
          expected_delivery_date: formData.expected_delivery_date || null,
          delivery_charges: parseFloat(formData.delivery_charges.toString()) || 0,
          notes: formData.notes || null,
          status: 'Ordered'
        }])
        .select()
        .single();

      if (poError) throw poError;

      // 2. Insert PO Lines with decoupled physical vs commercial split valuation
      const linesToInsert = validLines.map(line => ({
        purchase_order_id: poData.id,
        product_id: line.product_id,
        quantity: line.quantity,
        unit_cost: (Number(line.billed_rate) || 0) + (Number(line.cash_rate) || 0),
        billed_rate: Number(line.billed_rate) || 0,
        cash_rate: Number(line.cash_rate) || 0,
        gst_amount: line.gst_amount || 0,
        is_billed: (Number(line.billed_rate) || 0) > 0
      }));

      const { error: linesError } = await supabase
        .from('purchase_order_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;

      router.push('/purchase-orders');
    } catch (err: any) {
      setError(err.message || 'Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading suppliers and products...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Create Purchase Order"
        description="Issue an official procurement order to your vendor with tax specifications"
        backHref="/purchase-orders"
        badge={
          <Badge variant="secondary" className="font-mono text-[11px]">
            {formData.po_number}
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

        {/* PO Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Procurement Details</CardTitle>
            <CardDescription>Specify supplier, dates, and order identifier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  PO Number <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.po_number}
                  onChange={e => setFormData({ ...formData, po_number: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Supplier <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.supplier_id}
                  onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select Vendor / Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.company_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Order Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={formData.order_date}
                  onChange={e => setFormData({ ...formData, order_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Expected Delivery
                </label>
                <input
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={e => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Freight / Delivery Charges (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.delivery_charges}
                  onChange={e => setFormData({ ...formData, delivery_charges: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Ordered Items</CardTitle>
              <CardDescription>Select stock items and configure purchase rates</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
              className="h-8 gap-1.5 text-xs"
            >
              <Icons.add className="w-3.5 h-3.5" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/50 border-y sm:border-y-0 sm:border-b border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5 min-w-[200px]">Product</th>
                    <th className="px-2 py-2.5 w-20">Qty</th>
                    <th className="px-2 py-2.5 w-36 text-center">Billing Mode</th>
                    <th className="px-2 py-2.5 w-48 text-center">Rate Breakdown (₹)</th>
                    <th className="px-2 py-2.5 w-24 text-right">Total Rate</th>
                    <th className="px-2 py-2.5 w-20 text-center">GST %</th>
                    <th className="px-2 py-2.5 w-24 text-right">GST (₹)</th>
                    <th className="px-3 py-2.5 w-28 text-right">Line Total</th>
                    <th className="px-2 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {lines.map((line, idx) => {
                    const lineTotal = (line.quantity * line.unit_cost) + (line.gst_amount || 0);
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
                                {p.name} ({p.sku_code || 'No SKU'} - {p.unit})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-3">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={line.quantity}
                            onChange={e => handleLineChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            required
                            className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <select
                            value={line.billing_mode}
                            onChange={e => handleLineChange(idx, 'billing_mode', e.target.value)}
                            className={`w-full px-2 py-1.5 rounded-md border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring ${
                              line.billing_mode === 'split'
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                                : line.billing_mode === 'cash'
                                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30'
                                : 'bg-primary/10 text-primary border-primary/30'
                            }`}
                          >
                            <option value="billed">Billed (100%)</option>
                            <option value="cash">Cash (100%)</option>
                            <option value="split">Split (Bill & Cash)</option>
                          </select>
                        </td>
                        <td className="px-2 py-3">
                          {line.billing_mode === 'split' ? (
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1">
                                <div className="text-[10px] text-primary font-medium mb-0.5">Bill Rate</div>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.billed_rate}
                                  onChange={e => handleLineChange(idx, 'billed_rate', parseFloat(e.target.value) || 0)}
                                  placeholder="Bill"
                                  className="w-full px-2 py-1 rounded border border-primary/30 bg-primary/5 text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                              <div className="flex-1">
                                <div className="text-[10px] text-orange-600 dark:text-orange-400 font-medium mb-0.5">Cash Rate</div>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.cash_rate}
                                  onChange={e => handleLineChange(idx, 'cash_rate', parseFloat(e.target.value) || 0)}
                                  placeholder="Cash"
                                  className="w-full px-2 py-1 rounded border border-orange-500/30 bg-orange-500/5 text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-500"
                                />
                              </div>
                            </div>
                          ) : line.billing_mode === 'cash' ? (
                            <div>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.cash_rate}
                                onChange={e => handleLineChange(idx, 'cash_rate', parseFloat(e.target.value) || 0)}
                                placeholder="Cash Rate"
                                className="w-full px-2 py-1.5 rounded-md border border-orange-500/30 bg-orange-500/5 text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-500"
                              />
                              <div className="text-[10px] text-orange-600 dark:text-orange-400 mt-0.5">Unbilled cash only</div>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.billed_rate}
                                onChange={e => handleLineChange(idx, 'billed_rate', parseFloat(e.target.value) || 0)}
                                placeholder="Billed Rate"
                                className="w-full px-2 py-1.5 rounded-md border border-primary/30 bg-primary/5 text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <div className="text-[10px] text-primary mt-0.5">100% Tax invoice</div>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            ₹{line.unit_cost.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={line.gst_rate}
                            onChange={e => handleLineChange(idx, 'gst_rate', parseFloat(e.target.value) || 0)}
                            disabled={line.billing_mode === 'cash' || line.billed_rate === 0}
                            className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-foreground text-xs text-center focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
                          />
                        </td>
                        <td className="px-2 py-3 text-right font-mono text-xs text-muted-foreground">
                          <div>₹{line.gst_amount.toFixed(2)}</div>
                          {line.billing_mode === 'split' && (
                            <div className="text-[10px] text-muted-foreground/70">on bill amt</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold text-foreground">
                          ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={lines.length === 1}
                            className="text-muted-foreground hover:text-destructive disabled:opacity-20 transition-colors p-1"
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

            {/* Financial Summary */}
            <div className="border-t border-border/60 p-4 sm:p-6 bg-muted/20 flex flex-col items-end space-y-1.5 text-xs sm:text-sm">
              <div className="flex justify-between w-full max-w-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                  Billed Subtotal (Taxable Value):
                </span>
                <span className="font-mono font-medium text-foreground">₹{calculateBilledSubtotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between w-full max-w-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
                  Cash Subtotal (Non-GST Base):
                </span>
                <span className="font-mono font-medium text-foreground">₹{calculateCashSubtotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between w-full max-w-sm text-muted-foreground">
                <span>Total Input GST (ITC):</span>
                <span className="font-mono font-medium text-foreground">₹{calculateTotalGST().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between w-full max-w-sm pt-1 border-t border-border/40 text-muted-foreground text-xs">
                <span>Total Billed Tax Invoice Value:</span>
                <span className="font-mono font-semibold text-primary">₹{calculateTotalBilledInvoice().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {formData.delivery_charges > 0 && (
                <div className="flex justify-between w-full max-w-sm text-muted-foreground">
                  <span>Freight / Delivery:</span>
                  <span className="font-mono font-medium text-foreground">₹{Number(formData.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between w-full max-w-sm pt-2 border-t border-border text-base font-bold text-foreground">
                <span>Grand Total:</span>
                <span className="font-mono text-primary">₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes Card */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Notes & Special Terms</CardTitle>
            <CardDescription>Optional internal remarks or specific instructions for the vendor</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Provide delivery instructions, packaging conditions, or payment milestones..."
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" asChild>
            <Link href="/purchase-orders">
              Cancel
            </Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Icons.refresh className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Generating PO...
              </>
            ) : (
              <>
                <Icons.success className="w-3.5 h-3.5 mr-1.5" />
                Create Purchase Order
              </>
            )}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
