'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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

    // Re-evaluate line prices based on whether customer uses GST or non-GST prices
    if (cust) {
      const updatedLines = lines.map(line => {
        if (!line.product_id) return line;
        const prod = products.find(p => p.id === line.product_id);
        if (!prod) return line;

        // If customer is GST customer, unit_price = price_non_gst (and GST is added on top)
        // If customer is Non-GST customer, unit_price = price_non_gst (with 0% GST rate for simple cash billing) or price_gst
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

      // 1. Create Sales Order
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

      // 2. Insert Sales Order Lines
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
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link href="/sales-orders" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          ← Back to Sales Orders
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mt-2">New Sales Order</h1>
        <p className="text-gray-600 mt-1">Create an outbound customer order with automatic GST / Non-GST pricing</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md">{error}</div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">Order Header</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Order Number *</label>
              <input
                type="text"
                value={formData.order_number}
                onChange={e => setFormData({ ...formData, order_number: e.target.value })}
                required
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Customer *</label>
              <select
                value={formData.customer_id}
                onChange={e => handleCustomerChange(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Select Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company_name} ({c.is_gst_customer ? 'GST' : 'Non-GST'})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Order Date *</label>
              <input
                type="date"
                value={formData.order_date}
                onChange={e => setFormData({ ...formData, order_date: e.target.value })}
                required
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Expected Delivery Date</label>
              <input
                type="date"
                value={formData.delivery_date}
                onChange={e => setFormData({ ...formData, delivery_date: e.target.value })}
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Delivery Charges (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.delivery_charges}
                onChange={e => setFormData({ ...formData, delivery_charges: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {selectedCustomer && (
              <div className="space-y-1 bg-blue-50 p-3 rounded-md">
                <div className="text-xs font-semibold text-blue-700 uppercase">Customer Tier</div>
                <div className="text-sm text-blue-900 font-medium">
                  {selectedCustomer.is_gst_customer ? 'Registered GST Customer' : 'Unregistered / Cash Customer'}
                </div>
                <div className="text-xs text-blue-600">
                  {selectedCustomer.credit_limit ? `Credit Limit: ₹${selectedCustomer.credit_limit.toLocaleString('en-IN')}` : 'No credit limit set'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delivery Details */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Delivery & Destination</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Delivery Address</label>
              <input
                type="text"
                placeholder="Site address or location"
                value={formData.delivery_address}
                onChange={e => setFormData({ ...formData, delivery_address: e.target.value })}
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
              <input
                type="tel"
                placeholder="Receiver phone number"
                value={formData.delivery_contact_phone}
                onChange={e => setFormData({ ...formData, delivery_contact_phone: e.target.value })}
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">Ordered Items</h2>
            <button
              type="button"
              onClick={addLine}
              className="text-sm px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md font-medium hover:bg-blue-100 transition-colors"
            >
              + Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="py-2 pr-4 min-w-[220px]">Product</th>
                  <th className="py-2 px-4 w-24">Qty</th>
                  <th className="py-2 px-4 w-32">Unit Price (₹)</th>
                  <th className="py-2 px-4 w-24">GST %</th>
                  <th className="py-2 px-4 w-28">GST (₹)</th>
                  <th className="py-2 px-4 w-32 text-right">Line Total</th>
                  <th className="py-2 pl-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, idx) => {
                  const lineTotal = (line.quantity * line.unit_price) + (line.gst_amount || 0);
                  const currentProd = products.find(p => p.id === line.product_id);
                  return (
                    <tr key={idx}>
                      <td className="py-3 pr-4">
                        <select
                          value={line.product_id}
                          onChange={e => handleProductChange(idx, e.target.value)}
                          required
                          className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                          <option value="">Select Product</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stock: {p.current_stock} {p.unit})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={e => handleLineChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          required
                          className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={e => handleLineChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                          required
                          className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={line.gst_rate}
                          onChange={e => handleLineChange(idx, 'gst_rate', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 font-medium">
                        ₹{line.gst_amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                        ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          disabled={lines.length === 1}
                          className="text-red-500 hover:text-red-700 disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-200 pt-4 flex flex-col items-end space-y-2">
            <div className="text-sm text-gray-600">
              Subtotal: <span className="font-semibold text-gray-800">₹{calculateSubtotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="text-sm text-gray-600">
              GST: <span className="font-semibold text-gray-800">₹{calculateTotalGST().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            {formData.delivery_charges > 0 && (
              <div className="text-sm text-gray-600">
                Delivery Charges: <span className="font-semibold text-gray-800">₹{Number(formData.delivery_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="text-lg font-bold text-gray-900 border-t border-gray-200 pt-2">
              Grand Total: ₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-2">
          <label className="block text-sm font-medium text-gray-700">Notes & Instructions</label>
          <textarea
            rows={3}
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Delivery terms, special remarks..."
            className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex justify-end space-x-4">
          <Link
            href="/sales-orders"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-300"
          >
            {loading ? 'Creating Order...' : 'Create Sales Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
