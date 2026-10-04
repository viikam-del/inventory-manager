'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

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
      const { data, error } = await supabase.from('segments').select('*').order('name');
      if (!error) setSegments(data || []);
    };
    const fetchCategories = async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (!error) setCategories(data || []);
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
          .eq('category_id', formData.category_id)
          .order('name');
        if (!error) setSubCategories(data || []);
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
      let sku = formData.sku_code;
      if (!sku) {
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

      // Check for duplicate non-deleted products
      const { existingProducts, error: checkError } = await supabase
        .from('products')
        .select('id, name, sku_code')
        .or(`name.eq.${formData.name},sku_code.eq.${sku}`)
        .eq('is_deleted', false)
        .limit(2);

      if (checkError) throw checkError;

      if (existingProducts && existingProducts.length > 0) {
        const hasDuplicateName = existingProducts.some(p => p.name.toLowerCase() === formData.name.toLowerCase());
        const hasDuplicateSku = existingProducts.some(p => p.sku_code === sku);

        let errorMessage = 'A product with this ';
        if (hasDuplicateName && hasDuplicateSku) {
          errorMessage += 'name and SKU code already exists.';
        } else if (hasDuplicateName) {
          errorMessage += 'name already exists.';
        } else {
          errorMessage += 'SKU code already exists.';
        }

        throw new Error(errorMessage);
      }

      const { error: insertError } = await supabase.from('products').insert({
        name: formData.name,
        sku_code: sku,
        unit: formData.unit,
        hsn_code: formData.hsn_code,
        gst_rate: formData.gst_rate,
        price_gst: parseFloat(formData.price_gst) || 0,
        price_non_gst: parseFloat(formData.price_non_gst) || 0,
        min_stock_level: parseFloat(formData.min_stock_level) || 0,
        current_stock: parseFloat(formData.current_stock) || 0,
        segment_id: formData.segment_id || null,
        category_id: formData.category_id || null,
        sub_category_id: formData.sub_category_id || null,
        notes: formData.notes,
      });

      if (insertError) throw insertError;
      router.push('/products');
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Add New Product"
        description="Register a new SKU with tax rates, dual pricing tiers, and reorder safety thresholds"
        backHref="/products"
        backLabel="Back to Catalog"
      />

      <div className="max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Card className="border-destructive/30 bg-destructive/10">
              <CardContent className="p-4 flex items-center gap-3 text-destructive text-sm font-medium">
                <Icons.warning className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </CardContent>
            </Card>
          )}

          {/* Section 1: Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product Identification</CardTitle>
              <CardDescription className="text-xs">Primary naming, SKU identifier, and unit of measurement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Product Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Shell Rimula R4 X 15W-40"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Unit of Measure <span className="text-destructive">*</span>
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="L">Liters (L)</option>
                    <option value="PCS">Pieces (PCS)</option>
                    <option value="KG">Kilograms (KG)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    SKU Code <span className="text-muted-foreground font-normal">(Auto-generated if empty)</span>
                  </label>
                  <input
                    type="text"
                    name="sku_code"
                    value={formData.sku_code}
                    onChange={handleChange}
                    placeholder="e.g. SHE-L-042"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    HSN Code <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    name="hsn_code"
                    value={formData.hsn_code}
                    onChange={handleChange}
                    required
                    placeholder="e.g. 27101980"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Pricing & Tax Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tax & Dual Pricing Tiers</CardTitle>
              <CardDescription className="text-xs">GST tax schedule and differentiated customer pricing rates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    GST Rate (%) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    name="gst_rate"
                    value={formData.gst_rate}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Price (GST Customer) ₹ <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    name="price_gst"
                    value={formData.price_gst}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Price (Non-GST Customer) ₹ <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    name="price_non_gst"
                    value={formData.price_non_gst}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Stock Control & Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stock Levels & Classification</CardTitle>
              <CardDescription className="text-xs">Inventory safety limits and organizational hierarchy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Initial Stock Count
                  </label>
                  <input
                    type="number"
                    name="current_stock"
                    value={formData.current_stock}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Minimum Reorder Threshold <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    name="min_stock_level"
                    value={formData.min_stock_level}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/40">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Segment</label>
                  <select
                    name="segment_id"
                    value={formData.segment_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select Segment</option>
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Category</label>
                  <select
                    name="category_id"
                    value={formData.category_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Sub-Category</label>
                  <select
                    name="sub_category_id"
                    value={formData.sub_category_id}
                    onChange={handleChange}
                    disabled={!formData.category_id}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  >
                    <option value="">Select Sub-Category</option>
                    {subCategories.map((sc) => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <label className="text-xs font-semibold text-foreground">Internal Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Optional notes or supplier details..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" type="button" asChild>
              <Link href="/products">Cancel</Link>
            </Button>
            <Button type="submit" disabled={loading} className="min-w-[120px]">
              {loading ? (
                <>
                  <Icons.refresh className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Icons.success className="w-4 h-4 mr-1.5" />
                  Save Product
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
