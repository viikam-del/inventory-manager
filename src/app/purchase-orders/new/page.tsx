'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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
  gst_rate: number;
  gst_amount: number;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    po_number: `PO-${Math.floor(100000 + Math.random() * 900000)}`,
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    delivery_charges: 0,
    notes: '',
  });

  const [lines, setLines] = useState<POLineItem[]>([
    { product_id: '', quantity: 1, unit_cost: 0, gst_rate: 18, gst_amount: 0 }
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const [suppliersRes, productsRes] = await Promise.all([
          supabase.from('suppliers').select('id, company_name, default_credit_days').eq('is_deleted', false).order('company_name'),
          supabase.from('products').select('id, name, sku_code, unit, gst_rate, price_gst, price_non_gst').eq('is_deleted', false).order('name')
        ]);

        if (suppliersRes.error) throw suppliersRes.error;
        if (productsRes.error) throw productsRes.error;

        setSuppliers(suppliersRes.data || []);
        setProducts(productsRes.data || []);
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
      const gstAmt = (qty * unitCost * gstRate) / 100;
      updated[index] = {
        product_id: productId,
        quantity: qty,
        unit_cost: unitCost,
        gst_rate: gstRate,
        gst_amount: Number(gstAmt.toFixed(2))
      };
    } else {
      updated[index].product_id = '';
    }
    setLines(updated);
  };

  const handleLineChange = (index: number, field: keyof POLineItem, value: number) => {
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      [field]: value
    };

    if (field === 'quantity' || field === 'unit_cost' || field === 'gst_rate') {
      const qty = field === 'quantity' ? value : updated[index].quantity;
      const cost = field === 'unit_cost' ? value : updated[index].unit_cost;
      const rate = field === 'gst_rate' ? value : updated[index].gst_rate;
      updated[index].gst_amount = Number(((qty * cost * rate) / 100).toFixed(2));
    }

    setLines(updated);
  };

  const addLine = () => {
    setLines(prev => [...prev, { product_id: '', quantity: 1, unit_cost: 0, gst_rate: 18, gst_amount: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return lines.reduce((acc, l) => acc + (l.quantity * l.unit_cost), 0);
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

      // 2. Insert PO Lines
      const linesToInsert = validLines.map(line => ({
        purchase_order_id: poData.id,
        product_id: line.product_id,
        quantity: line.quantity,
        unit_cost: line.unit_cost,
        gst_amount: line.gst_amount
      }));

      const { error: linesError } = await supabase
        .from('purchase_order_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;

      router.push(`/purchase-orders/${poData.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create purchase order');
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
        <Link href="/purchase-orders" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          ← Back to Purchase Orders
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mt-2">New Purchase Order</h1>
        <p className="text-gray-600 mt-1">Issue an official purchase order to a supplier</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md">{error}</div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">Order Header</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">PO Number *</label>
              <input
                type="text"
                value={formData.po_number}
                onChange={e => setFormData({ ...formData, po_number: e.target.value })}
                required
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Supplier *</label>
              <select
                value={formData.supplier_id}
                onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
                required
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Select Supplier</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.company_name}</option>
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
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Expected Delivery</label>
              <input
                type="date"
                value={formData.expected_delivery_date}
                onChange={e => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">Items Ordered</h2>
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
                  <th className="py-2 pr-4 min-w-[200px]">Product</th>
                  <th className="py-2 px-4 w-24">Qty</th>
                  <th className="py-2 px-4 w-32">Unit Cost (₹)</th>
                  <th className="py-2 px-4 w-24">GST %</th>
                  <th className="py-2 px-4 w-28">GST (₹)</th>
                  <th className="py-2 px-4 w-32 text-right">Line Total</th>
                  <th className="py-2 pl-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, idx) => {
                  const lineTotal = (line.quantity * line.unit_cost) + (line.gst_amount || 0);
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
                              {p.name} ({p.unit})
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
                          value={line.unit_cost}
                          onChange={e => handleLineChange(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
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
          <label className="block text-sm font-medium text-gray-700">Notes & Delivery Instructions</label>
          <textarea
            rows={3}
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Special instructions, terms, payment specifications..."
            className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="flex justify-end space-x-4">
          <Link
            href="/purchase-orders"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-300"
          >
            {loading ? 'Creating PO...' : 'Create Purchase Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
