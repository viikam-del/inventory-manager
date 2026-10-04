'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageContainer, PageHeader } from '@/components/layout/page-wrapper';

export default function NewReminderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    whatsapp_number: '',
    whatsapp_template: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: insertError } = await supabase.from('reminders').insert([
        {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          type: 'Manual',
          status: 'Pending',
          reference_type: 'Manual',
          whatsapp_number: formData.whatsapp_number.trim() || null,
          whatsapp_template: formData.whatsapp_template.trim() || null,
        }
      ]);

      if (insertError) throw insertError;
      router.push('/reminders');
    } catch (err: any) {
      console.error('Failed to create reminder', err);
      setError(err.message || 'Failed to create reminder');
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Create Custom Reminder"
        description="Add a manual follow-up or alert"
        backHref="/reminders"
      />

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="p-6 space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md flex items-center gap-2">
                  <Icons.warning className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Reminder Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Call vendor for discount"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full text-sm bg-background border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  placeholder="Add context or notes"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full text-sm bg-background border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary min-h-[80px]"
                />
              </div>

              <div className="pt-4 border-t border-border/50">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <Icons.share className="w-4 h-4 text-[#25D366]" /> WhatsApp Action (Optional)
                </h3>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g., 919876543210 (include country code)"
                      value={formData.whatsapp_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                      className="w-full text-sm bg-background border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Pre-filled Message Template</label>
                    <textarea
                      placeholder="Hello, I wanted to follow up on..."
                      value={formData.whatsapp_template}
                      onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_template: e.target.value }))}
                      className="w-full text-sm bg-background border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary min-h-[80px]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => router.push('/reminders')} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="gap-2 shadow-xs">
                  {loading && <Icons.refresh className="w-4 h-4 animate-spin" />}
                  Save Reminder
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </PageContainer>
  );
}
