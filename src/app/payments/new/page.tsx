'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Customer {
  id: string;
  company_name: string;
  opening_balance: number;
}

export default function NewPaymentPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    customer_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'UPI',
    reference_number: '',
    notes: '',
  });

  useEffect(() => {
    async function loadCustomers() {
      try {
        const { data, error: supabaseError } = await supabase
          .from('customers')
          .select('id, company_name, opening_balance')
          .eq('is_deleted', false)
          .order('company_name');

        if (supabaseError) throw supabaseError;
        setCustomers(data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load customers');
      } finally {
        setFetching(false);
      }
    }
    loadCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.customer_id) {
      setError('Please select a customer');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    setLoading(true);
    try {
      const { error: insertError } = await supabase
        .from('payments')
        .insert([{
          customer_id: formData.customer_id,
          amount: parseFloat(formData.amount),
          payment_date: formData.payment_date,
          payment_method: formData.payment_method,
          reference_number: formData.reference_number || null,
          notes: formData.notes || null,
        }]);

      if (insertError) throw insertError;

      router.push('/payments');
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link href="/payments" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          ← Back to Payments
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mt-2">Record Customer Payment</h1>
        <p className="text-gray-600 mt-1">Enter details of a collection received from a customer</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md">{error}</div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Customer *</label>
              <select
                value={formData.customer_id}
                onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
                required
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Select Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                required
                placeholder="0.00"
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Payment Date *</label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={e => setFormData({ ...formData, payment_date: e.target.value })}
                required
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Payment Method *</label>
              <select
                value={formData.payment_method}
                onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                required
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Reference / Transaction ID</label>
              <input
                type="text"
                placeholder="UPI ID, Cheque No, or Bank Ref #"
                value={formData.reference_number}
                onChange={e => setFormData({ ...formData, reference_number: e.target.value })}
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional details about the payment..."
              className="w-full px-4 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <Link
            href="/payments"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-300"
          >
            {loading ? 'Recording Payment...' : 'Save Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
