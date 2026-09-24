'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function NewProductPage() {
  const [formData, setFormData] = useState({
    name: '',
    sku_code: '',
    unit: 'L' as 'L' | 'PCS' | 'KG',
    hsn_code: '',
    gst_rate: 18,
    price_gst: '',
    price_non_gst: '',
    min_stock_level: '',
    current_stock: '',
    segment_id: '',
    category_id: '',
    sub_category_id: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchSegments = async () => {
      const { data, error } = await supabase.from('segments').select('*');
      if (!error) setSegments(data);
    };
    const fetchCategories = async () => {
      const { data, error } = await supabase.from('categories').select('*');
      if (!error) setCategories(data);
    };
    fetchSegments();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (formData.category_id) {
      const fetchSubCategories = async () => {
        const { data, error } = await supabase
          .from('sub_categories')
          .select('*')
          .eq('category_id', formData.category_id);
        if (!error) setSubCategories(data);
      };
      fetchSubCategories();
    } else {
      setSubCategories([]);
    }
  }, [formData.category_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target;
    const name = target.name;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Generate SKU if not provided
      let sku = formData.sku_code;
      if (!sku) {
        // We'll generate a simple SKU for now
        const namePart = formData.name
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 3);
        const unitPart = formData.unit.toUpperCase();
        const randomPart = Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, '0');
        sku = `${namePart}-${unitPart}-${randomPart}`;
      }

      const { data, error } = await supabase.from('products').insert({
        name: formData.name,
        sku_code: sku,
        unit: formData.unit,
        hsn_code: formData.hsn_code,
        gst_rate: formData.gst_rate,
        price_gst: parseFloat(formData.price_gst),
        price_non_gst: parseFloat(formData.price_non_gst),
        min_stock_level: parseFloat(formData.min_stock_level),
        current_stock: parseFloat(formData.current_stock),
        segment_id: formData.segment_id,
        category_id: formData.category_id,
        sub_category_id: formData.sub_category_id || null,
        notes: formData.notes,
      });

      if (error) throw error;

      router.push('/products');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-5">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Add New Product</h1>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SKU Code (optional, will be auto-generated)
                  </label>
                  <input
                    type="text"
                    name="sku_code"
                    value={formData.sku_code}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="L">Liters (L)</option>
                    <option value="PCS">Pieces (PCS)</option>
                    <option value="KG">Kilograms (KG)</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      HSN Code
                    </label>
                    <input
                      type="text"
                      name="hsn_code"
                      value={formData.hsn_code}
                      onChange={handleChange}
                      required
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GST Rate (%)
                    </label>
                    <input
                      type="number"
                      name="gst_rate"
                      value={formData.gst_rate}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      step="0.01"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (GST Customer) ₹
                    </label>
                    <input
                      type="number"
                      name="price_gst"
                      value={formData.price_gst}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (Non-GST Customer) ₹
                    </label>
                    <input
                      type="number"
                      name="price_non_gst"
                      value={formData.price_non_gst}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Stock Level
                    </label>
                    <input
                      type="number"
                      name="min_stock_level"
                      value={formData.min_stock_level}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Stock
                    </label>
                    <input
                      type="number"
                      name="current_stock"
                      value={formData.current_stock}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Segment
                      </label>
                      <select
                        name="segment_id"
                        value={formData.segment_id}
                        onChange={handleChange}
                        required
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      >
                        <option value="">Select a segment</option>
                        {segments.map((segment: any) => (
                          <option key={segment.id} value={segment.id}>
                            {segment.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <select
                        name="category_id"
                        value={formData.category_id}
                        onChange={handleChange}
                        required
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      >
                        <option value="">Select a category</option>
                        {categories.map((category: any) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sub-Category
                      </label>
                      <select
                        name="sub_category_id"
                        value={formData.sub_category_id}
                        onChange={handleChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      >
                        <option value="">Select a sub-category (optional)</option>
                        {subCategories.map((subCategory: any) => (
                          <option key={subCategory.id} value={subCategory.id}>
                            {subCategory.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between px-6 py-5 bg-gray-50">
                <Link
                  href="/products"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}