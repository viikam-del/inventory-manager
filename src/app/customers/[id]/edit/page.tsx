'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    whatsapp: '',
    email: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    delivery_contact_person: '',
    delivery_contact_phone: '',
    delivery_address: '',
    same_as_company_address: false,
    gstin: '',
    is_gst_customer: false,
    is_dealer: false,
    default_due_days: 7,
    credit_limit: '',
    opening_balance: '',
    notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchCustomer() {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', params.id)
        .single();

      if (supabaseError) throw supabaseError;

      if (data) {
        setFormData({
          company_name: data.company_name || '',
          contact_person: data.contact_person || '',
          phone: data.phone || '',
          whatsapp: data.whatsapp || '',
          email: data.email || '',
          address_line1: data.address_line1 || data.address || '',
          address_line2: data.address_line2 || '',
          city: data.city || '',
          state: data.state || '',
          pincode: data.pincode || '',
          delivery_contact_person: data.delivery_contact_person || '',
          delivery_contact_phone: data.delivery_contact_phone || '',
          delivery_address: data.delivery_address || '',
          same_as_company_address: false,
          gstin: data.gstin || '',
          is_gst_customer: data.is_gst_customer || false,
          is_dealer: data.is_dealer || false,
          default_due_days: data.default_due_days || 7,
          credit_limit: data.credit_limit?.toString() || '',
          opening_balance: data.opening_balance?.toString() || '',
          notes: data.notes || '',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load customer details';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    async function load() {
      await fetchCustomer();
    }
    load();
    return () => { isMounted = false; };
  }, [params.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checkedValue = isCheckbox ? (e.target as HTMLInputElement).checked : value;

    setFormData(prev => {
      const nextState = {
        ...prev,
        [name]: checkedValue
      };

      if (name === 'same_as_company_address' && checkedValue) {
        const formattedAddress = `${prev.address_line1 || ''}, ${prev.address_line2 || ''}, ${prev.city || ''}, ${prev.state || ''} - ${prev.pincode || ''}`.replace(/^, |, $/, '').trim();
        nextState.delivery_address = formattedAddress;
      }

      return nextState;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');

    const data = {
      company_name: formData.company_name,
      contact_person: formData.contact_person,
      phone: formData.phone,
      whatsapp: formData.whatsapp,
      email: formData.email,
      address: `${formData.address_line1 || ''}, ${formData.address_line2 || ''}, ${formData.city || ''}, ${formData.state || ''} - ${formData.pincode || ''}`.replace(/^, |, $/, '').trim(),
      delivery_contact_person: formData.delivery_contact_person,
      delivery_contact_phone: formData.delivery_contact_phone,
      delivery_address: formData.delivery_address,
      gstin: formData.gstin,
      is_gst_customer: formData.is_gst_customer,
      is_dealer: formData.is_dealer,
      default_due_days: formData.default_due_days,
      credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
      opening_balance: formData.opening_balance ? parseFloat(formData.opening_balance) : 0,
      notes: formData.notes,
    };

    const { error: supabaseError } = await supabase
      .from('customers')
      .update(data)
      .eq('id', params.id);

    if (supabaseError) {
      setError(supabaseError.message);
    } else {
      router.push(`/customers/${params.id}`);
    }
    setSubmitLoading(false);
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Icons.refresh className="animate-spin h-8 w-8 text-primary mx-auto" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Loading customer data...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Edit Customer"
        description="Update customer details and delivery preferences"
        backHref="/customers"
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
            <CardDescription>Company identity and contact details</CardDescription>
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
                  Phone <span className="text-destructive">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Street Address / Plot No.
                  </label>
                  <input
                    type="text"
                    name="address_line1"
                    value={formData.address_line1}
                    onChange={handleChange}
                    placeholder="e.g. Plot 42, Industrial Area"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Area / Locality
                  </label>
                  <input
                    type="text"
                    name="address_line2"
                    value={formData.address_line2}
                    onChange={handleChange}
                    placeholder="e.g. Odhav, Sector 4"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="e.g. Ahmedabad"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="e.g. Gujarat"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Pincode
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="e.g. 382415"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery & Site Details</CardTitle>
            <CardDescription>Specific contact and address for delivery locations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Delivery Contact Person
                </label>
                <input
                  type="text"
                  name="delivery_contact_person"
                  value={formData.delivery_contact_person}
                  onChange={handleChange}
                  placeholder="Person in charge at site"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Delivery Phone
                </label>
                <input
                  type="tel"
                  name="delivery_contact_phone"
                  value={formData.delivery_contact_phone}
                  onChange={handleChange}
                  placeholder="Site contact number"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="same_as_company_address"
                  checked={formData.same_as_company_address}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-foreground">Same as Company Address</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Delivery / Site Address
                </label>
                <textarea
                  name="delivery_address"
                  value={formData.delivery_address}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Enter full delivery address..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial & Billing Settings</CardTitle>
            <CardDescription>GST configuration and credit constraints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  name="is_gst_customer"
                  checked={formData.is_gst_customer}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">GST Registered Company</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  name="is_dealer"
                  checked={formData.is_dealer}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Wholesale Dealer</span>
              </label>
            </div>

            {formData.is_gst_customer && (
              <div className="space-y-1.5 max-w-sm">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  GSTIN <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  name="gstin"
                  value={formData.gstin}
                  onChange={handleChange}
                  required={formData.is_gst_customer}
                  maxLength={15}
                  placeholder="e.g., 27AAACCA23..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Default Due Days
                </label>
                <input
                  type="number"
                  name="default_due_days"
                  value={formData.default_due_days}
                  onChange={handleChange}
                  min={0}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Credit Limit (₹)
                </label>
                <input
                  type="number"
                  name="credit_limit"
                  value={formData.credit_limit}
                  onChange={handleChange}
                  step="0.01"
                  min={0}
                  placeholder="No limit"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Opening Balance (₹)
                </label>
                <input
                  type="number"
                  name="opening_balance"
                  value={formData.opening_balance}
                  onChange={handleChange}
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Internal references or instructions..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/customers">Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitLoading}>
            {submitLoading ? (
              <>
                <Icons.refresh className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Icons.save className="w-3.5 h-3.5 mr-1.5" />
                Update Customer
              </>
            )}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
