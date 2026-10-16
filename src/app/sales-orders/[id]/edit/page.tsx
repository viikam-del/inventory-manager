'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';
import { logAuditEvent } from '@/lib/audit';

interface Customer {
  id: string;
  company_name: string;
  phone: string;
  address: string;
  gstin: string | null;
  is_gst_customer: boolean;
  credit_limit: number | null;
}

interface Product {
  id: string;
  name: string;
  sku_code: string;
  unit: string;
  price_gst: number;
  price_non_gst: number;
  gst_rate: number;
  current_stock: number;
}

interface OrderLineItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  gst_amount: number;
}

export default function EditSalesOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [formData, setFormData] = useState({
    order_number: '',
    customer_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    delivery_address: '',
    delivery_contact_person: '',
    delivery_contact_phone: '',
    delivery_method: 'Self Pickup',
    delivery_charges: '0',
    notes: '',
    status: 'Draft',
  });

  const [isGstOrder, setIsGstOrder] = useState(true);
  const [lines, setLines] = useState<OrderLineItem[]>([
    { product_id: '', quantity: 1, unit_price: 0, gst_rate: 18, gst_amount: 0 }
  ]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // 1. Fetch Customers
        const { data: custData, error: custErr } = await supabase
          .from('customers')
          .select('id, company_name, phone, address, gstin, is_gst_customer, credit_limit')
          .eq('is_deleted', false)
          .order('company_name');
        if (custErr) throw custErr;
        setCustomers(custData || []);

        // 2. Fetch Products
        const { data: prodData, error: prodErr } = await supabase
          .from('products')
          .select('id, name, sku_code, unit, price_gst, price_non_gst, gst_rate, current_stock')
          .eq('is_deleted', false)
          .order('name');
        if (prodErr) throw prodErr;
        setProducts(prodData || []);

        // 3. Fetch Sales Order & Lines
        const { data: orderData, error: orderErr } = await supabase
          .from('sales_orders')
          .select('*')
          .eq('id', orderId)
          .single();
        if (orderErr) throw orderErr;

        if (orderData) {
          setFormData({
            order_number: orderData.order_number || '',
            customer_id: orderData.customer_id || '',
            order_date: orderData.order_date || new Date().toISOString().split('T')[0],
            expected_delivery_date: orderData.expected_delivery_date || '',
            delivery_address: orderData.delivery_address || '',
            delivery_contact_person: orderData.delivery_contact_person || '',
            delivery_contact_phone: orderData.delivery_contact_phone || '',
            delivery_method: orderData.delivery_method || 'Self Pickup',
            delivery_charges: orderData.delivery_charges?.toString() || '0',
            notes: orderData.notes || '',
            status: orderData.status || 'Draft',
          });
          setIsGstOrder(orderData.is_gst ?? true);

          if (orderData.customer_id) {
            const foundCust = custData?.find(c => c.id === orderData.customer_id);
            if (foundCust) setSelectedCustomer(foundCust);
          }
        }

        const { data: linesData, error: linesErr } = await supabase
          .from('sales_order_lines')
          .select('*')
          .eq('sales_order_id', orderId);
        if (linesErr) throw linesErr;

        if (linesData && linesData.length > 0) {
          setLines(linesData.map(l => ({
            product_id: l.product_id,
            quantity: Number(l.quantity),
            unit_price: Number(l.unit_price),
            gst_rate: l.gst_amount > 0 ? 18 : 0, // approximate or standard
            gst_amount: Number(l.gst_amount || 0)
          })));
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load sales order for editing');
      } finally {
        setLoading(false);
      }
    }
    if (orderId) loadData();
  }, [orderId]);

  const handleCustomerChange = (customerId: string) => {
    setFormData(prev => ({ ...prev, customer_id: customerId }));
    const cust = customers.find(c => c.id === customerId);
    if (cust) {
      setSelectedCustomer(cust);
      if (!formData.delivery_address && cust.address) {
        setFormData(prev => ({ ...prev, delivery_address: cust.address }));
      }
      if (!formData.delivery_contact_phone && cust.phone) {
        setFormData(prev => ({ ...prev, delivery_contact_phone: cust.phone }));
      }
    } else {
      setSelectedCustomer(null);
    }
  };

  const toggleGstMode = (newGstMode: boolean) => {
    setIsGstOrder(newGstMode);
    recalculateLinesForGst(newGstMode);
  };

  const recalculateLinesForGst = (isGst: boolean) => {
    const updatedLines = lines.map(line => {
      if (!line.product_id) return line;
      const prod = products.find(p => p.id === line.product_id);
      if (!prod) return line;

      const unitPrice = isGst ? Number(prod.price_non_gst) : Number(prod.price_gst);
      const gstRate = isGst ? Number(prod.gst_rate) : 0;
      const gstAmount = isGst ? (line.quantity * unitPrice * gstRate) / 100 : 0;

      return {
        ...line,
        unit_price: unitPrice,
        gst_rate: gstRate,
        gst_amount: Number(gstAmount.toFixed(2))
      };
    });
    setLines(updatedLines);
  };

  const handleProductChange = (index: number, productId: string) => {
    const selectedProd = products.find(p => p.id === productId);
    const updated = [...lines];

    if (selectedProd) {
      const isGst = isGstOrder;
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
    const isGst = isGstOrder;
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

    const subtotal = calculateSubtotal();
    const gstAmount = calculateTotalGST();
    const grandTotal = calculateGrandTotal();

    setSubmitting(true);

    try {
      // 1. Update Sales Order Header
      const { error: orderError } = await supabase
        .from('sales_orders')
        .update({
          customer_id: formData.customer_id,
          order_date: formData.order_date,
          expected_delivery_date: formData.expected_delivery_date || null,
          delivery_address: formData.delivery_address || null,
          delivery_contact_person: formData.delivery_contact_person || null,
          delivery_contact_phone: formData.delivery_contact_phone || null,
          delivery_charges: parseFloat(formData.delivery_charges.toString()) || 0,
          delivery_method: formData.delivery_method || null,
          notes: formData.notes || null,
          is_gst: isGstOrder,
          subtotal: subtotal,
          gst_amount: gstAmount,
          total_amount: grandTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // 2. Replace Sales Order Lines (delete old ones and insert new ones)
      const { error: deleteLinesErr } = await supabase
        .from('sales_order_lines')
        .delete()
        .eq('sales_order_id', orderId);

      if (deleteLinesErr) throw deleteLinesErr;

      const linesToInsert = validLines.map(line => ({
        sales_order_id: orderId,
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price: line.unit_price,
        gst_amount: line.gst_amount,
        total_amount: Number((line.quantity * line.unit_price + line.gst_amount).toFixed(2)),
      }));

      const { error: insertLinesErr } = await supabase
        .from('sales_order_lines')
        .insert(linesToInsert);

      if (insertLinesErr) throw insertLinesErr;

      // 3. Log audit event
      void logAuditEvent(
        'sales_order',
        orderId,
        'update',
        null,
        {
          order_number: formData.order_number,
          customer_name: selectedCustomer?.company_name,
          grand_total: grandTotal,
          is_gst: isGstOrder,
          line_count: linesToInsert.length,
        }
      );

      router.push(`/sales-orders/${orderId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update sales order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading sales order for editing...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  const subtotal = calculateSubtotal();
  const gstAmount = calculateTotalGST();
  const grandTotal = calculateGrandTotal();

  return (
    <PageContainer>
      <PageHeader
        title={`Edit Sales Order: ${formData.order_number}`}
        description="Modify order details, items, pricing, or delivery preferences"
        backHref={`/sales-orders/${orderId}`}
        backLabel="Back to Order Details"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Card className="border-destructive/30 bg-destructive/10">
            <CardContent className="p-4 flex items-center gap-3 text-destructive text-sm font-medium">
              <Icons.warning className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Customer & Order Information</CardTitle>
                <CardDescription className="text-xs">Select customer and billing terms</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Customer <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={formData.customer_id}
                      onChange={e => handleCustomerChange(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">-- Select Customer --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.company_name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Order Number
                    </label>
                    <input
                      type="text"
                      value={formData.order_number}
                      disabled
                      className="w-full px-3 py-2 rounded-lg border border-input bg-muted/50 text-muted-foreground text-sm font-mono cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Order Date <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.order_date}
                      onChange={e => setFormData({ ...formData, order_date: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Expected Delivery Date
                    </label>
                    <input
                      type="date"
                      value={formData.expected_delivery_date}
                      onChange={e => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Tax Mode Toggle */}
                <div className="pt-2 border-t border-border/40">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-2">
                    Tax / Pricing Classification
                  </label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => toggleGstMode(true)}
                      className={`flex-1 py-2 px-4 rounded-lg border text-xs font-medium transition-colors ${
                        isGstOrder
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-input hover:bg-muted/50'
                      }`}
                    >
                      Tax Invoice (GST 18%)
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleGstMode(false)}
                      className={`flex-1 py-2 px-4 rounded-lg border text-xs font-medium transition-colors ${
                        !isGstOrder
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-input hover:bg-muted/50'
                      }`}
                    >
                      Cash / Non-GST (Dealer Rate)
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Delivery & Logistics</CardTitle>
                <CardDescription className="text-xs">Dispatch method, delivery site address, and contact</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Delivery Method
                    </label>
                    <select
                      value={formData.delivery_method}
                      onChange={e => setFormData({ ...formData, delivery_method: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Self Pickup">Self Pickup</option>
                      <option value="Transport Courier">Transport Courier</option>
                      <option value="Direct Delivery">Direct Delivery</option>
                      <option value="Bus Parcel">Bus Parcel</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Delivery Charges (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.delivery_charges}
                      onChange={e => setFormData({ ...formData, delivery_charges: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Delivery Contact Person
                    </label>
                    <input
                      type="text"
                      placeholder="Site contact name"
                      value={formData.delivery_contact_person}
                      onChange={e => setFormData({ ...formData, delivery_contact_person: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Delivery Contact Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="Site contact phone"
                      value={formData.delivery_contact_phone}
                      onChange={e => setFormData({ ...formData, delivery_contact_phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Full Delivery Address / Site Location
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter site address..."
                    value={formData.delivery_address}
                    onChange={e => setFormData({ ...formData, delivery_address: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Order Notes / Special Instructions
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Internal reference or dispatch instructions..."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer Credit Health & Summary Sidebar */}
          <div className="space-y-6">
            {selectedCustomer && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Customer Account Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs pt-0">
                  <div className="font-bold text-sm text-foreground">{selectedCustomer.company_name}</div>
                  <div className="text-muted-foreground flex items-center gap-1.5">
                    <Icons.phone className="w-3.5 h-3.5" /> {selectedCustomer.phone}
                  </div>
                  {selectedCustomer.credit_limit !== null && selectedCustomer.credit_limit !== undefined && (
                    <div className="pt-2 border-t border-border/40 flex justify-between">
                      <span className="text-muted-foreground">Credit Limit:</span>
                      <span className="font-mono font-bold text-foreground">
                        ₹{Number(selectedCustomer.credit_limit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Order Totals Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-mono font-medium text-foreground">
                    ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST (18%):</span>
                  <span className="font-mono font-medium text-foreground">
                    ₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Charges:</span>
                  <span className="font-mono font-medium text-foreground">
                    ₹{Number(formData.delivery_charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pt-2 border-t border-border/60 flex justify-between text-sm font-bold">
                  <span className="text-foreground">Grand Total:</span>
                  <span className="font-mono text-primary text-base">
                    ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="pt-4 flex flex-col gap-2">
                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? (
                      <>
                        <Icons.refresh className="w-4 h-4 mr-2 animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <Icons.save className="w-4 h-4 mr-2" />
                        Update Sales Order
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" asChild className="w-full">
                    <Link href={`/sales-orders/${orderId}`}>Cancel</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Order Lines Builder */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Icons.inventory className="w-4 h-4 text-primary" /> Order Items ({lines.length})
              </CardTitle>
              <CardDescription className="text-xs">Select products and quantities</CardDescription>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addLine} className="h-8 text-xs">
              <Icons.add className="w-3.5 h-3.5 mr-1.5" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {lines.map((line, idx) => {
                const selectedProd = products.find(p => p.id === line.product_id);
                return (
                  <div key={idx} className="p-3 rounded-lg border border-border/60 bg-muted/20 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-5 space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase">Product</label>
                      <select
                        value={line.product_id}
                        onChange={e => handleProductChange(idx, e.target.value)}
                        required
                        className="w-full px-3 py-1.5 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">-- Select Product --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stock: {p.current_stock} {p.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                        Qty ({selectedProd?.unit || 'units'})
                      </label>
                      <input
                        type="number"
                        min={0.01}
                        step="any"
                        value={line.quantity}
                        onChange={e => handleLineChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        required
                        className="w-full px-3 py-1.5 rounded-md border border-input bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase">Unit Price (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unit_price}
                        onChange={e => handleLineChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                        required
                        className="w-full px-3 py-1.5 rounded-md border border-input bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase">Total (₹)</label>
                      <div className="px-3 py-1.5 rounded-md bg-muted text-foreground text-xs font-mono font-bold flex items-center justify-between">
                        <span>₹{((line.quantity * line.unit_price) + (line.gst_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length === 1}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Icons.trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </form>
    </PageContainer>
  );
}
