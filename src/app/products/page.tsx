'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const router = useRouter();

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
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;
      setProducts(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

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

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku_code && p.sku_code.toLowerCase().includes(search.toLowerCase())) ||
    (p.hsn_code && p.hsn_code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in slide-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">Manage inventory items, pricing, and stock levels</p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Icons.add className="w-4 h-4 mr-2" /> Add Product
          </Link>
        </Button>
      </div>

      <div className="mb-6 relative max-w-md">
        <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, SKU, or HSN code..."
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center">
            <Icons.refresh className="animate-spin h-10 w-10 text-primary mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Loading products...</p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 bg-destructive/10 p-6 text-center mb-6">
          <Icons.warning className="w-10 h-10 text-destructive mx-auto mb-2" />
          <p className="font-bold text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => fetchProducts()}>
            Try Again
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted border-b text-muted-foreground font-medium">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">SKU</th>
                  <th className="px-6 py-3">HSN Code</th>
                  <th className="px-6 py-3">GST Price</th>
                  <th className="px-6 py-3">Non-GST Price</th>
                  <th className="px-6 py-3">Stock</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length > 0 ? (
                  filtered.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {product.name}
                      </td>
                      <td className="px-6 py-4">
                        {product.sku_code ? (
                          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{product.sku_code}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {product.hsn_code || '—'}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        ₹{Number(product.price_gst).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        ₹{Number(product.price_non_gst).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{product.current_stock} {product.unit}</span>
                          {product.current_stock <= product.min_stock_level ? (
                            <Badge variant="destructive" className="px-1.5 py-0">Low</Badge>
                          ) : (
                            <Badge variant="success" className="px-1.5 py-0">OK</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                          className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border-0"
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      No products found. Add a new product to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
