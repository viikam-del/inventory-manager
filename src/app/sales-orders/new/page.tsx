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
  contact_person?: string | null;
  phone?: string | null;
  address?: string | null;
  delivery_address?: string | null;
  delivery_contact_person?: string | null;
  delivery_contact_phone?: string | null;
  gstin?: string | null;
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
  const [isGstOrder, setIsGstOrder] = useState<boolean>(true);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    order_number: 'Generating...',
    customer_id: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: new Date().toISOString().split('T')[0],
    delivery_address: '',
    delivery_contact_person: '',
    delivery_contact_phone: '',
    delivery_charges: 0,
    delivery_method: 'Porter',
    notes: '',
  });

  const [lines, setLines] = useState<OrderLineItem[]>([
    { product_id: '', quantity: 1, unit_price: 0, gst_rate: 18, gst_amount: 0 }
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const [customersRes, productsRes, lastSORes] = await Promise.all([
          supabase.from('customers').select('*').eq('is_deleted', false).order('company_name'),
          supabase.from('products').select('*').eq('is_deleted', false).order('name'),
          supabase.from('sales_orders').select('order_number').not('order_number', 'is', null).order('order_number', { ascending: false }).limit(1)
        ]);

        if (customersRes.error) throw customersRes.error;
        if (productsRes.error) throw productsRes.error;

        setCustomers(customersRes.data || []);
        setProducts(productsRes.data || []);

        // Generate sequential SO number
        if (lastSORes.data && lastSORes.data.length > 0 && lastSORes.data[0].order_number) {
          const lastSO = lastSORes.data[0].order_number;
          const match = lastSO.match(/SO-(\d+)/);
          if (match && match[1]) {
            const nextNum = parseInt(match[1], 10) + 1;
            setFormData(prev => ({ ...prev, order_number: `SO-${String(nextNum).padStart(4, '0')}` }));
          } else {
            setFormData(prev => ({ ...prev, order_number: `SO-${Date.now().toString().slice(-4)}` }));
          }
        } else {
          setFormData(prev => ({ ...prev, order_number: `SO-0001` }));
        }
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
    const targetIsGst = cust ? cust.is_gst_customer : true;
    setIsGstOrder(targetIsGst);

    setFormData(prev => ({
      ...prev,
      customer_id: customerId,
      delivery_address: cust?.delivery_address || cust?.address || prev.delivery_address,
      delivery_contact_person: cust?.delivery_contact_person || cust?.contact_person || prev.delivery_contact_person,
      delivery_contact_phone: cust?.delivery_contact_phone || cust?.phone || prev.delivery_contact_phone,
    }));

    recalculateLinesForGst(targetIsGst);
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

    // 1. Stock Availability Check
    const stockIssues: string[] = [];
    for (const line of validLines) {
      const prod = products.find(p => p.id === line.product_id);
      if (prod && line.quantity > prod.current_stock) {
        stockIssues.push(`- ${prod.name}: Requested ${line.quantity}, Available ${prod.current_stock}`);
      }
    }

    if (stockIssues.length > 0) {
      const msg = `Warning: Insufficient stock for the following items:\n${stockIssues.join('\n')}\n\nDo you want to proceed anyway?`;
      if (!window.confirm(msg)) {
        return;
      }
    }

    const subtotal = calculateSubtotal();
    const gstAmount = calculateTotalGST();
    const grandTotal = calculateGrandTotal();

    // 2. Credit Limit Validation
    if (selectedCustomer && selectedCustomer.credit_limit && selectedCustomer.credit_limit > 0) {
      try {
        const { data: salesData } = await supabase.from('sales_orders').select('total_amount, gst_amount').eq('customer_id', selectedCustomer.id).eq('is_deleted', false);
        const { data: payData } = await supabase.from('payments').select('amount').eq('customer_id', selectedCustomer.id).eq('is_deleted', false);

        const totalSales = (salesData || []).reduce((acc, row) => acc + (Number(row.total_amount) || 0) + (Number(row.gst_amount) || 0), 0);
        const totalPays = (payData || []).reduce((acc, row) => acc + (Number(row.amount) || 0), 0);

        const currentDue = Number(selectedCustomer.opening_balance || 0) + totalSales - totalPays;
        // As grandTotal is our new amount we are adding to the order, wait, let's align our calculation with payments page
        // Payments page adds gst_amount to total_amount for the sales_orders.
        // So this new order will add grandTotal + gstAmount to the customer's due if we follow that metric.
        // But let's just add grandTotal for sanity check since it holds the total order value.
        const newOrderAddedValue = grandTotal + gstAmount; // To match the payment page behavior where gst_amount is added
        const totalProjectedDue = currentDue + newOrderAddedValue;

        if (totalProjectedDue > selectedCustomer.credit_limit) {
          const msg = `Credit Limit Exceeded!\nCustomer: ${selectedCustomer.company_name}\nCredit Limit: ₹${selectedCustomer.credit_limit.toLocaleString('en-IN')}\n\nCurrent Due: ₹${currentDue.toLocaleString('en-IN')}\nNew Order Value (w/ calculation adj): ₹${newOrderAddedValue.toLocaleString('en-IN')}\nProjected Due: ₹${totalProjectedDue.toLocaleString('en-IN')}\n\nAre you sure you want to approve this order?`;
          if (!window.confirm(msg)) {
            return;
          }
        }
      } catch (err) {
        console.error("Credit limit check failed", err);
      }
    }

    setLoading(true);

    try {
      // 3. Collision Handling for Order Numbering
      let finalOrderNumber = formData.order_number;
      const { data: existingOrder } = await supabase
        .from('sales_orders')
        .select('id')
        .eq('order_number', finalOrderNumber);

      if (existingOrder && existingOrder.length > 0) {
        // Regenerate order number safely
        const { data: lastSORes } = await supabase.from('sales_orders').select('order_number').not('order_number', 'is', null).order('order_number', { ascending: false }).limit(1);
        if (lastSORes && lastSORes.length > 0 && lastSORes[0].order_number) {
          const match = lastSORes[0].order_number.match(/SO-(\d+)/);
          if (match && match[1]) {
            finalOrderNumber = `SO-${String(parseInt(match[1], 10) + 1).padStart(4, '0')}`;
          } else {
            finalOrderNumber = `SO-${Date.now().toString().slice(-4)}`;
          }
        }
        alert(`Order number ${formData.order_number} was already taken. Automatically re-assigned to ${finalOrderNumber}`);
      }

      const { data: orderData, error: orderError } = await supabase
        .from('sales_orders')
        .insert([{
          order_number: finalOrderNumber,
          customer_id: formData.customer_id,
          order_date: formData.order_date,
          delivery_date: formData.delivery_date || null,
          delivery_address: formData.delivery_address || null,
          delivery_contact_person: formData.delivery_contact_person || null,
          delivery_contact_phone: formData.delivery_contact_phone || null,
          delivery_charges: parseFloat(formData.delivery_charges.toString()) || 0,
          delivery_method: formData.delivery_method || null,
          notes: formData.notes || null,
          status: 'Draft',
          is_gst: isGstOrder,
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
        total_amount: Number((line.quantity * line.unit_price + line.gst_amount).toFixed(2)),
      }));

      const { error: linesError } = await supabase
        .from('sales_order_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;

      router.push('/sales-orders');
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
          {/* Main Form Rail (2 Columns on Desktop) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1: Order Header */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Icons.customers className="w-4 h-4 text-primary" /> Order Information & Client
                </CardTitle>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
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
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Delivery Logistics */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Icons.delivery className="w-4 h-4 text-primary" /> Delivery Logistics & Site Details
                </CardTitle>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Delivery Method / Mode</label>
                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      {['Porter', 'Customer Pickup', 'Self Delivery', 'Courier / Transport', 'Other'].map(method => (
                        <label key={method} className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                          <input
                            type="radio"
                            name="delivery_method"
                            value={method}
                            checked={formData.delivery_method === method}
                            onChange={e => setFormData({ ...formData, delivery_method: e.target.value })}
                            className="w-4 h-4 text-primary focus:ring-primary"
                          />
                          <span>{method}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Receiver Contact Person</label>
                    <input
                      type="text"
                      placeholder="Name of person receiving / picking up order"
                      value={formData.delivery_contact_person}
                      onChange={e => setFormData({ ...formData, delivery_contact_person: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Ordered Line Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Icons.sales className="w-4 h-4 text-primary" /> Order Line Items
                  </CardTitle>
                  <CardDescription className="text-xs">Add products, quantities, tax schedules, and negotiated unit rates</CardDescription>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addLine} className="h-8 text-xs shrink-0 self-start sm:self-auto">
                  <Icons.add className="w-3.5 h-3.5 mr-1" /> Add Product
                </Button>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-muted/50 border-y sm:border-y-0 sm:border-b border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="px-3 sm:px-4 py-3 min-w-[220px]">Product / SKU</th>
                        <th className="px-3 sm:px-4 py-3 w-24">Qty</th>
                        <th className="px-3 sm:px-4 py-3 w-32">Unit Price (₹)</th>
                        <th className="px-3 sm:px-4 py-3 w-24">GST %</th>
                        <th className="px-3 sm:px-4 py-3 w-28">GST (₹)</th>
                        <th className="px-3 sm:px-4 py-3 w-32 text-right">Line Total</th>
                        <th className="px-3 sm:px-4 py-3 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {lines.map((line, idx) => {
                        const lineTotal = (line.quantity * line.unit_price) + (line.gst_amount || 0);
                        return (
                          <tr key={idx} className="hover:bg-muted/20 transition-colors">
                            <td className="px-3 sm:px-4 py-2.5">
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
                            <td className="px-3 sm:px-4 py-2.5">
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
                            <td className="px-3 sm:px-4 py-2.5">
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
                            <td className="px-3 sm:px-4 py-2.5">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={line.gst_rate}
                                onChange={e => handleLineChange(idx, 'gst_rate', parseFloat(e.target.value) || 0)}
                                className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 text-xs text-muted-foreground font-mono">
                              ₹{line.gst_amount.toFixed(2)}
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 text-xs text-right font-bold font-mono text-foreground">
                              ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 text-center">
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
              </CardContent>
            </Card>
          </div>

          {/* Sticky Financial Sidebar (1 Column on Desktop) */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-6">
            {/* Order Financial Calculation Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Icons.receipts className="w-4 h-4 text-primary" /> Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxable Subtotal</span>
                  <span className="font-mono font-medium text-foreground">
                    ₹{calculateSubtotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {isGstOrder && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST Tax Amount</span>
                    <span className="font-mono font-medium text-foreground">
                      ₹{calculateTotalGST().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {Number(formData.delivery_charges) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Freight / Delivery</span>
                    <span className="font-mono font-medium text-foreground">
                      ₹{Number(formData.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="pt-3 border-t border-border/60 flex justify-between items-baseline">
                  <span className="font-semibold text-foreground">Grand Total</span>
                  <span className="font-mono font-bold text-lg text-primary">
                    ₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Customer Tax Mode & Credit Info */}
            {selectedCustomer && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase text-primary tracking-wider flex items-center gap-1.5">
                      <Icons.receipts className="w-3.5 h-3.5" /> Tax Mode
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleGstMode(!isGstOrder)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        isGstOrder ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${
                          isGstOrder ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant={isGstOrder ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 h-4">
                      {isGstOrder ? 'GST Invoice' : 'Cash Invoice'}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {isGstOrder ? 'Product GST Rates' : '0% GST'}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-foreground pt-2 border-t border-primary/10 flex items-center justify-between">
                    <span className="text-muted-foreground">Credit Limit</span>
                    <span className="font-mono">
                      {selectedCustomer.credit_limit
                        ? `₹${Number(selectedCustomer.credit_limit).toLocaleString('en-IN')}`
                        : 'No Limit'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Notes & Terms */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Icons.document className="w-4 h-4 text-primary" /> Notes & Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <textarea
                  rows={3}
                  placeholder="Add dispatch instructions, packing notes, or terms..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </CardContent>
            </Card>

            {/* Form Submission Actions */}
            <div className="flex flex-col gap-2.5">
              <Button type="submit" disabled={loading} className="w-full h-10 font-semibold shadow-xs">
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
              <Button type="button" variant="outline" asChild className="w-full h-9">
                <Link href="/sales-orders">Cancel</Link>
              </Button>
            </div>
          </div>
        </div>
      </form>
    </PageContainer>
  );
}
