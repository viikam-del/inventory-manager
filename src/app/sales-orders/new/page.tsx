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

interface Customer {
  id: string;
  company_name: string;
  is_gst_customer: boolean;
  credit_limit: number | null;
  opening_balance: number;
}

interface Product {
  id: string;
  name: string;
  sku_code: string;
  unit: string;
  gst_rate: number;
  price_gst: number;
  price_non_gst: number;
  current_stock: number;
}

interface OrderLineItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  gst_amount: number;
}

export default function NewSalesOrderPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    order_number: `SO-${Math.floor(100000 + Math.random() * 900000)}`,
    customer_id: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    delivery_address: '',
    delivery_contact_person: '',
    delivery_contact_phone: '',
    delivery_charges: 0,
    notes: '',
  });

  const [lines, setLines] = useState<OrderLineItem[]>([
    { product_id: '', quantity: 1, unit_price: 0, gst_rate: 18, gst_amount: 0 }
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const [customersRes, productsRes] = await Promise.all([
          supabase.from('customers').select('*').eq('is_deleted', false).order('company_name'),
          supabase.from('products').select('*').eq('is_deleted', false).order('name')
        ]);

        if (customersRes.error) throw customersRes.error;
        if (productsRes.error) throw productsRes.error;

        setCustomers(customersRes.data || []);
        setProducts(productsRes.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load initial form data');
      } finally {
        setFetching(false);
      }
    }

    loadData();
  }, []);

  const handleCustomerChange = (customerId: string) => {
    const cust = customers.find(c => c.id === customerId) || null;
    setSelectedCustomer(cust);
    setFormData(prev => ({ ...prev, customer_id: customerId }));

    if (cust) {
      const updatedLines = lines.map(line => {
        if (!line.product_id) return line;
        const prod = products.find(p => p.id === line.product_id);
        if (!prod) return line;

        const unitPrice = cust.is_gst_customer ? Number(prod.price_non_gst) : Number(prod.price_gst);
        const gstRate = cust.is_gst_customer ? Number(prod.gst_rate) : 0;
        const gstAmount = cust.is_gst_customer ? (line.quantity * unitPrice * gstRate) / 100 : 0;

        return {
          ...line,
          unit_price: unitPrice,
          gst_rate: gstRate,
          gst_amount: Number(gstAmount.toFixed(2))
        };
      });
      setLines(updatedLines);
    }
  };

  const handleProductChange = (index: number, productId: string) => {
    const selectedProd = products.find(p => p.id === productId);
    const updated = [...lines];

    if (selectedProd) {
      const isGst = selectedCustomer?.is_gst_customer ?? true;
      const unitPrice = isGst ? Number(selectedProd.price_non_gst) : Number(selectedProd.price_gst);
      const gstRate = isGst ? Number(selectedProd.gst_rate) : 0;
      const qty = updated[index].quantity || 1;
      const gstAmt = isGst ? (qty * unitPrice * gstRate) / 100 : 0;

      updated[index] = {
        product_id: productId,
        quantity: qty,
        unit_price: unitPrice,
        gst_rate: gstRate,
        gst_amount: Number(gstAmt.toFixed(2))
      };
    } else {
      updated[index].product_id = '';
    }

    setLines(updated);
  };

  const handleLineChange = (index: number, field: keyof OrderLineItem, value: number) => {
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      [field]: value
    };

    if (field === 'quantity' || field === 'unit_price' || field === 'gst_rate') {
      const qty = field === 'quantity' ? value : updated[index].quantity;
      const price = field === 'unit_price' ? value : updated[index].unit_price;
      const rate = field === 'gst_rate' ? value : updated[index].gst_rate;
      updated[index].gst_amount = Number(((qty * price * rate) / 100).toFixed(2));
    }

    setLines(updated);
  };

  const addLine = () => {
    const isGst = selectedCustomer?.is_gst_customer ?? true;
    setLines(prev => [...prev, { product_id: '', quantity: 1, unit_price: 0, gst_rate: isGst ? 18 : 0, gst_amount: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return lines.reduce((acc, l) => acc + (l.quantity * l.unit_price), 0);
  };

  const calculateTotalGST = () => {
    return lines.reduce((acc, l) => acc + (l.gst_amount || 0), 0);
  };

  const calculateGrandTotal = () => {
    return calculateSubtotal() + calculateTotalGST() + Number(formData.delivery_charges || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.customer_id) {
      setError('Please select a customer');
      return;
    }

    const validLines = lines.filter(l => l.product_id && l.quantity > 0);
    if (validLines.length === 0) {
      setError('Please add at least one product with quantity > 0');
      return;
    }

    setLoading(true);

    try {
      const subtotal = calculateSubtotal();
      const gstAmount = calculateTotalGST();
      const grandTotal = calculateGrandTotal();

      const { data: orderData, error: orderError } = await supabase
        .from('sales_orders')
        .insert([{
          order_number: formData.order_number,
          customer_id: formData.customer_id,
          order_date: formData.order_date,
          delivery_date: formData.delivery_date || null,
          delivery_address: formData.delivery_address || null,
          delivery_contact_person: formData.delivery_contact_person || null,
          delivery_contact_phone: formData.delivery_contact_phone || null,
          delivery_charges: parseFloat(formData.delivery_charges.toString()) || 0,
          notes: formData.notes || null,
          status: 'Draft',
          subtotal: subtotal,
          gst_amount: gstAmount,
          total_amount: grandTotal
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      const linesToInsert = validLines.map(line => ({
        sales_order_id: orderData.id,
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price: line.unit_price,
        gst_amount: line.gst_amount,
        total_amount: (line.quantity * line.unit_price) + line.gst_amount
      }));

      const { error: linesError } = await supabase
        .from('sales_order_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;

      router.push(`/sales-orders/${orderData.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create sales order');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <PageContainer>
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading form configuration...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Create Sales Order"
        description="Draft a client order with automated GST/Non-GST pricing, credit limits, and delivery logistics"
        backHref="/sales-orders"
        backLabel="Back to Sales Orders"
      />

      <div className="max-w-5xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Card className="border-destructive/30 bg-destructive/10">
              <CardContent className="p-4 flex items-center gap-3 text-destructive text-sm font-medium">
                <Icons.warning className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </CardContent>
            </Card>
          )}

          {/* Section 1: Order Header */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Information & Client</CardTitle>
              <CardDescription className="text-xs">Select customer account and define scheduled dates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Order Number <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.order_number}
                    onChange={e => setFormData({ ...formData, order_number: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Customer Account <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={e => handleCustomerChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} ({c.is_gst_customer ? 'GST' : 'Non-GST'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/40">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={formData.delivery_date}
                    onChange={e => setFormData({ ...formData, delivery_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Freight / Delivery Charges (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.delivery_charges}
                    onChange={e => setFormData({ ...formData, delivery_charges: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {selectedCustomer && (
                  <div className="flex flex-col justify-center rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase text-primary tracking-wider">
                        {selectedCustomer.is_gst_customer ? 'GST Registered' : 'Non-GST Customer'}
                      </span>
                      <Badge variant={selectedCustomer.is_gst_customer ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {selectedCustomer.is_gst_customer ? 'Tax Invoice' : 'Cash Tier'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {selectedCustomer.credit_limit
                        ? `Credit Limit: ₹${Number(selectedCustomer.credit_limit).toLocaleString('en-IN')}`
                        : 'No formal credit limit set'}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Delivery Logistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delivery Logistics & Site Details</CardTitle>
              <CardDescription className="text-xs">Consignee destination address and dispatch point of contact</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Delivery / Site Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Plot 42, GIDC Industrial Estate, Odhav, Ahmedabad"
                    value={formData.delivery_address}
                    onChange={e => setFormData({ ...formData, delivery_address: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Receiver Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.delivery_contact_phone}
                    onChange={e => setFormData({ ...formData, delivery_contact_phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Ordered Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Order Line Items</CardTitle>
                <CardDescription className="text-xs">Add products, quantities, tax schedules, and negotiated unit rates</CardDescription>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addLine} className="h-8 text-xs">
                <Icons.add className="w-3.5 h-3.5 mr-1" /> Add Product
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5 min-w-[220px]">Product</th>
                      <th className="px-3 py-2.5 w-24">Qty</th>
                      <th className="px-3 py-2.5 w-32">Unit Price (₹)</th>
                      <th className="px-3 py-2.5 w-24">GST %</th>
                      <th className="px-3 py-2.5 w-28">GST (₹)</th>
                      <th className="px-3 py-2.5 w-32 text-right">Line Total</th>
                      <th className="px-3 py-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {lines.map((line, idx) => {
                      const lineTotal = (line.quantity * line.unit_price) + (line.gst_amount || 0);
                      return (
                        <tr key={idx} className="hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2.5">
                            <select
                              value={line.product_id}
                              onChange={e => handleProductChange(idx, e.target.value)}
                              required
                              className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <option value="">Select Product SKU</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Stock: {p.current_stock} {p.unit})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={line.quantity}
                              onChange={e => handleLineChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              required
                              className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unit_price}
                              onChange={e => handleLineChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                              required
                              className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={line.gst_rate}
                              onChange={e => handleLineChange(idx, 'gst_rate', parseFloat(e.target.value) || 0)}
                              className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                            ₹{line.gst_amount.toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right font-bold font-mono text-foreground">
                            ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2.5 text-center">
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

              {/* Order Financial Calculation Summary */}
              <div className="border-t border-border/50 pt-4 mt-4 flex flex-col items-end space-y-1.5">
                <div className="flex items-center justify-between w-64 text-xs text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium text-foreground">
                    ₹{calculateSubtotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between w-64 text-xs text-muted-foreground">
                  <span>GST Taxes:</span>
                  <span className="font-mono font-medium text-foreground">
                    ₹{calculateTotalGST().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {formData.delivery_charges > 0 && (
                  <div className="flex items-center justify-between w-64 text-xs text-muted-foreground">
                    <span>Freight / Delivery:</span>
                    <span className="font-mono font-medium text-foreground">
                      ₹{Number(formData.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between w-64 text-sm font-bold border-t border-border/60 pt-2 text-foreground">
                  <span>Grand Total:</span>
                  <span className="font-mono text-primary text-base">
                    ₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Notes & Terms</CardTitle>
              <CardDescription className="text-xs">Internal dispatch reminders or commercial conditions</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <textarea
                rows={3}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Payment terms, delivery gate instructions, special packing remarks..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" type="button" asChild>
              <Link href="/sales-orders">Cancel</Link>
            </Button>
            <Button type="submit" disabled={loading} className="min-w-[140px]">
              {loading ? (
                <>
                  <Icons.refresh className="w-4 h-4 mr-2 animate-spin" />
                  Creating Order...
                </>
              ) : (
                <>
                  <Icons.success className="w-4 h-4 mr-1.5" />
                  Create Sales Order
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
