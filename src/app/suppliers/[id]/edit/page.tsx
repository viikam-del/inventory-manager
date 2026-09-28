'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

export default function EditSupplierPage() {
  const params = useParams();
  const router = useRouter();
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    gstin: '',
    is_gst_supplier: false,
    bank_account_number: '',
    bank_ifsc: '',
    bank_name: '',
    bank_branch: '',
    default_credit_days: 30,
    notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function fetchSupplier() {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', params.id)
        .eq('is_deleted', false)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        setFormData({
          company_name: data.company_name || '',
          contact_person: data.contact_person || '',
          phone: data.phone || '',
          whatsapp: data.whatsapp || '',
          email: data.email || '',
          address: data.address || '',
          gstin: data.gstin || '',
          is_gst_supplier: Boolean(data.is_gst_supplier),
          bank_account_number: data.bank_account_number || '',
          bank_ifsc: data.bank_ifsc || '',
          bank_name: data.bank_name || '',
          bank_branch: data.bank_branch || '',
          default_credit_days: data.default_credit_days ?? 30,
          notes: data.notes || ''
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch supplier details');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSupplier();
  }, [params.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const data = {
        ...formData,
        default_credit_days: Number(formData.default_credit_days) || 0
      };

      const { error: updateError } = await supabase
        .from('suppliers')
        .update(data)
        .eq('id', params.id);

      if (updateError) throw updateError;
      router.push(`/suppliers/${params.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update supplier');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading supplier...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={`Edit Supplier: ${formData.company_name}`}
        description="Update vendor information, bank details, and procurement terms"
        backHref={`/suppliers/${params.id}`}
      />

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        {error && (
          <Card className="border-destructive/30 bg-destructive/5 text-destructive p-4">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Icons.warning className="w-4 h-4 shrink-0" />
              {error}
            </div>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Company identity and communication details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Company Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Phone Number <span className="text-destructive">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  placeholder="Include country code (e.g., 919876543210)"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Full Address
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax & Credit Details</CardTitle>
            <CardDescription>GST compliance and standard supplier payment terms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_gst_supplier"
                name="is_gst_supplier"
                checked={formData.is_gst_supplier}
                onChange={handleChange}
                className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
              />
              <label htmlFor="is_gst_supplier" className="text-sm font-medium text-foreground cursor-pointer">
                Is GST Registered Vendor?
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {formData.is_gst_supplier && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    GSTIN <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    name="gstin"
                    value={formData.gstin}
                    onChange={handleChange}
                    required={formData.is_gst_supplier}
                    maxLength={15}
                    placeholder="22AAAAA0000A1Z5"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Default Credit Days
                </label>
                <input
                  type="number"
                  name="default_credit_days"
                  value={formData.default_credit_days}
                  onChange={handleChange}
                  min={0}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Banking Information</CardTitle>
            <CardDescription>Vendor payout bank details for electronic remittances</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Bank Name
                </label>
                <input
                  type="text"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleChange}
                  placeholder="e.g. HDFC Bank"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Branch Name
                </label>
                <input
                  type="text"
                  name="bank_branch"
                  value={formData.bank_branch}
                  onChange={handleChange}
                  placeholder="e.g. Indiranagar Branch"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Account Number
                </label>
                <input
                  type="text"
                  name="bank_account_number"
                  value={formData.bank_account_number}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  IFSC Code
                </label>
                <input
                  type="text"
                  name="bank_ifsc"
                  value={formData.bank_ifsc}
                  onChange={handleChange}
                  placeholder="e.g. HDFC0001234"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Internal Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Additional notes about supplier reliability, payment terms, or discounts..."
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href={`/suppliers/${params.id}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Icons.refresh className="w-4 h-4 mr-2 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Icons.save className="w-4 h-4 mr-2" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
