'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateStaffPin } from '@/lib/auth';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export default function StaffLoginPage() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key >= '0' && e.key <= '9') {
      onNumClick(e.key);
    } else if (e.key === 'Backspace') {
      handleBackspace();
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async (currentPin: string) => {
    if (currentPin.length !== 4) return;
    setLoading(true);
    setError('');

    try {
      const res = await validateStaffPin(currentPin);
      if (res.success && res.user) {
        localStorage.setItem('rds_staff_user', JSON.stringify(res.user));
        router.push('/staff/deliveries');
      } else {
        setError(res.error || 'Invalid PIN. Please try again.');
        setPin('');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const onNumClick = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setError('');
      if (newPin.length === 4) {
        handleSubmit(newPin);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-8 animate-in slide-up fade-in duration-500">

        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-sm">
            <Icons.delivery className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950 tracking-tight">Staff Delivery Portal</h1>
          <p className="text-slate-500 text-sm">Enter your 4-digit PIN to access dispatches</p>
        </div>

        <Card className="bg-white border-slate-200 shadow-xl rounded-2xl">
          <CardContent className="p-8 pb-10">
            {/* Hidden Input for Keyboard/Mobile support */}
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className="opacity-0 absolute -z-10"
              value={pin}
              onChange={() => {}}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={loading}
            />

            {/* PIN Dots Display */}
            <div className="flex justify-center gap-4 mb-8">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-4 h-4 rounded-full transition-all duration-300 border",
                    pin.length > i
                      ? "bg-primary border-primary scale-110 shadow-md shadow-primary/30"
                      : "bg-slate-100 border-slate-300"
                  )}
                />
              ))}
            </div>

            {error && (
              <div className="text-center mb-6 bg-red-50 border border-red-200 p-3 rounded-xl">
                <p className="text-red-600 text-xs font-semibold">{error}</p>
              </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <Button
                  key={num}
                  variant="outline"
                  className="h-16 rounded-2xl text-2xl font-medium bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 hover:border-slate-300 shadow-sm transition-all active:scale-95"
                  onClick={() => onNumClick(num)}
                  disabled={loading}
                >
                  {num}
                </Button>
              ))}
              <div /> {/* Spacer */}
              <Button
                variant="outline"
                className="h-16 rounded-2xl text-2xl font-medium bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 hover:border-slate-300 shadow-sm transition-all active:scale-95"
                onClick={() => onNumClick('0')}
                disabled={loading}
              >
                0
              </Button>
              <Button
                variant="ghost"
                className="h-16 rounded-2xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95 flex items-center justify-center"
                onClick={handleBackspace}
                disabled={loading || pin.length === 0}
              >
                <Icons.back className="w-6 h-6" />
              </Button>
            </div>

            {loading && (
              <div className="text-center mt-6">
                <Icons.refresh className="w-6 h-6 text-primary animate-spin mx-auto" />
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
