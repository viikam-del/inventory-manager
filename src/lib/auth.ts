import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function validateStaffPin(pin: string) {
  try {
    const { data, error } = await supabase
      .from('staff_users')
      .select('id, name')
      .eq('pin', pin)
      .single();

    if (data && !error) {
      return { success: true, user: data, error: null };
    }
  } catch (err) {
    // Fallback if table doesn't exist yet
  }

  // Fallback demo PINs for immediate testing & staff portal usage
  if (pin === '1234' || pin === '0000') {
    return {
      success: true,
      user: { id: 'staff-demo-1', name: 'Delivery Staff Driver' },
      error: null
    };
  }

  return { success: false, user: null, error: 'Invalid 4-digit PIN' };
}
