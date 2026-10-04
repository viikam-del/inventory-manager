'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const Navbar = () => {
  const pathname = usePathname();

  // If in staff mode/deliveries, keep top navigation minimal or hidden
  if (pathname.startsWith('/staff')) {
    return null;
  }

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: Icons.dashboard },
    { name: 'Products', href: '/products', icon: Icons.products },
    { name: 'Customers', href: '/customers', icon: Icons.customers },
    { name: 'Suppliers', href: '/suppliers', icon: Icons.suppliers },
    { name: 'Purchase Orders', href: '/purchase-orders', icon: Icons.purchase },
    { name: 'Receipts (GRN)', href: '/receipts', icon: Icons.receipts },
    { name: 'Sales Orders', href: '/sales-orders', icon: Icons.sales },
    { name: 'Returns', href: '/customer-returns', icon: Icons.returns },
    { name: 'Supplier Returns', href: '/supplier-returns', icon: Icons.supplierReturns },
    { name: 'Adjustments', href: '/stock-adjustments', icon: Icons.stockAdjustments },
    { name: 'Reminders', href: '/reminders', icon: Icons.bell },
    { name: 'Payments', href: '/payments', icon: Icons.payments },
  ];

  return (
    <nav className="bg-card/95 backdrop-blur-md border-b sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm group-hover:scale-105 transition-transform">
                <Icons.inventory className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black tracking-tight text-foreground leading-none">
                  RDS Manager
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                  Inventory & Ops
                </span>
              </div>
            </Link>

            <div className="hidden lg:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild className="rounded-lg">
              <Link href="/staff/deliveries">
                <Icons.delivery className="w-4 h-4 mr-1.5 text-primary" />
                Staff View
              </Link>
            </Button>

            <div className="hidden sm:flex items-center gap-2 pl-3 border-l text-xs">
              <Badge variant="success" className="gap-1 font-mono text-[10px] py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Admin Active
              </Badge>
            </div>
          </div>
        </div>

        {/* Scrollable Sub-bar for mobile / smaller screens */}
        <div className="lg:hidden flex overflow-x-auto py-2.5 space-x-1 border-t border-border/50 no-scrollbar">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {link.name}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
