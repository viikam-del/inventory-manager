'use client';

import { useEffect, useState, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'ok'>('all');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('products')
        .select(`
          *,
          segment:segments(name),
          category:categories(name),
          sub_category:sub_categories(name)
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }).limit(1000);

      if (supabaseError) throw supabaseError;
      setProducts(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('products')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (deleteError) throw deleteError;
      fetchProducts();
    } catch (err: any) {
      alert('Failed to delete product: ' + err.message);
    }
  };

  const filtered = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      (p.sku_code && p.sku_code.toLowerCase().includes(deferredSearch.toLowerCase())) ||
      (p.hsn_code && p.hsn_code.toLowerCase().includes(deferredSearch.toLowerCase())) ||
      (p.category?.name && p.category.name.toLowerCase().includes(deferredSearch.toLowerCase()));

    if (!matchesSearch) return false;

    if (stockFilter === 'low') {
      return Number(p.current_stock) <= Number(p.min_stock_level);
    }
    if (stockFilter === 'ok') {
      return Number(p.current_stock) > Number(p.min_stock_level);
    }
    return true;
  });

  const lowStockTotal = products.filter(p => Number(p.current_stock) <= Number(p.min_stock_level)).length;

  return (
    <PageContainer>
      <PageHeader
        title="Product Catalog"
        description="Manage SKU definitions, GST tax pricing tiers, stock levels, and reorder thresholds"
        badge={
          <Badge variant="secondary" className="font-mono text-[11px]">
            {products.length} Items Total
          </Badge>
        }
        actions={
          <Button size="sm" asChild>
            <Link href="/products/new">
              <Icons.add className="w-3.5 h-3.5 mr-1.5" />
              Add Product
            </Link>
          </Button>
        }
      />

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by product name, SKU, HSN, category..."
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              <Icons.close className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Stock Filter Pills */}
        <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border/60 self-start sm:self-auto">
          <button
            onClick={() => setStockFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              stockFilter === 'all'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({products.length})
          </button>
          <button
            onClick={() => setStockFilter('low')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              stockFilter === 'low'
                ? 'bg-destructive/15 text-destructive font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Low Stock
            {lowStockTotal > 0 && (
              <span className="w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                {lowStockTotal}
              </span>
            )}
          </button>
          <button
            onClick={() => setStockFilter('ok')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              stockFilter === 'ok'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            In Stock ({products.length - lowStockTotal})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading catalog items...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 text-center py-8">
          <CardContent className="space-y-3">
            <Icons.warning className="w-8 h-8 text-destructive mx-auto" />
            <p className="font-semibold text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchProducts()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/60 border-b border-border/60 text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Product & SKU</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">HSN Code</th>
                  <th className="px-5 py-3">GST Price</th>
                  <th className="px-5 py-3">Non-GST Price</th>
                  <th className="px-5 py-3 text-center">Stock Level</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.length > 0 ? (
                  filtered.map((product) => {
                    const isLow = Number(product.current_stock) <= Number(product.min_stock_level);
                    return (
                      <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="space-y-0.5">
                            <Link
                              href={`/products/${product.id}`}
                              className="font-semibold text-foreground text-sm hover:text-primary dark:hover:text-primary hover:underline"
                            >
                              {product.name}
                            </Link>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {product.sku_code ? (
                                <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/40">
                                  {product.sku_code}
                                </span>
                              ) : null}
                              <span className="text-[10px] text-muted-foreground font-medium uppercase">
                                {product.unit}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {product.category?.name || product.segment?.name || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">
                          {product.hsn_code || '—'}
                        </td>
                        <td className="px-5 py-3.5 font-medium font-mono text-foreground">
                          ₹{Number(product.price_gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-3.5 font-medium font-mono text-foreground">
                          ₹{Number(product.price_non_gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-foreground">
                              {product.current_stock}
                            </span>
                            <Badge variant={isLow ? "destructive" : "success"} className="text-[10px] px-1.5 py-0">
                              {isLow ? `Low (Min ${product.min_stock_level})` : 'In Stock'}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {isLow && (
                              <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                                <Link href={`/purchase-orders/new?product_id=${product.id}`}>
                                  Reorder
                                </Link>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(product.id, product.name)}
                              className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Icons.trash className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Icons.products className="w-8 h-8 text-muted-foreground/60" />
                        <p className="font-medium text-sm">No products found matching your search.</p>
                        <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStockFilter('all'); }}>
                          Clear Filters
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
