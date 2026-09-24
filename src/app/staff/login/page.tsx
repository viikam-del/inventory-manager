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

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError('');
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
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-8 animate-in slide-up fade-in duration-500">

        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/30">
            <Icons.delivery className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Staff Portal</h1>
          <p className="text-slate-400 text-sm">Enter your 4-digit PIN to access dispatches</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700/50 shadow-2xl backdrop-blur-xl">
          <CardContent className="p-8 pb-10">
            {/* PIN Dots Display */}
            <div className="flex justify-center gap-4 mb-8">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-4 h-4 rounded-full transition-all duration-300",
                    pin.length > i
                      ? "bg-primary scale-110 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                      : "bg-slate-700"
                  )}
                />
              ))}
            </div>

            {error && (
              <div className="text-center mb-6">
                <p className="text-destructive text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <Button
                  key={num}
                  variant="outline"
                  className="h-16 rounded-full text-2xl font-normal bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                  onClick={() => onNumClick(num)}
                  disabled={loading}
                >
                  {num}
                </Button>
              ))}
              <div /> {/* Spacer */}
              <Button
                variant="outline"
                className="h-16 rounded-full text-2xl font-normal bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                onClick={() => onNumClick('0')}
                disabled={loading}
              >
                0
              </Button>
              <Button
                variant="ghost"
                className="h-16 rounded-full text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
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

            <p className="text-center text-xs text-slate-500 mt-6">Demo Staff PIN: 1234</p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
