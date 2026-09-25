'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'success' | 'warning';
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Icons.dashboard },
    ],
  },
  {
    title: 'Operations',
    items: [
      { name: 'Sales Orders', href: '/sales-orders', icon: Icons.sales },
      { name: 'Purchase Orders', href: '/purchase-orders', icon: Icons.purchase },
    ],
  },
  {
    title: 'Inventory & Stock',
    items: [
      { name: 'Products Catalog', href: '/products', icon: Icons.products },
      { name: 'Stock Receipts (GRN)', href: '/receipts', icon: Icons.receipts },
    ],
  },
  {
    title: 'Finance & Ledger',
    items: [
      { name: 'Payments & Collections', href: '/payments', icon: Icons.payments },
    ],
  },
  {
    title: 'Stakeholders',
    items: [
      { name: 'Customers', href: '/customers', icon: Icons.customers },
      { name: 'Suppliers', href: '/suppliers', icon: Icons.suppliers },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  // If in staff mode/deliveries, sidebar is not needed
  if (pathname.startsWith('/staff')) {
    return null;
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={onMobileClose}>
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm group-hover:scale-105 transition-transform">
            <Icons.inventory className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-foreground">RDS Manager</span>
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.2 rounded">PRO</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">Enterprise Inventory</span>
          </div>
        </Link>

        {onMobileClose && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8 text-muted-foreground"
            onClick={onMobileClose}
          >
            <Icons.close className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <h3 className="px-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
              {section.title}
            </h3>
            <div className="space-y-0.5 pt-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onMobileClose}
                    className={cn(
                      'group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                        : 'text-sidebar-foreground/80 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={cn(
                          'w-4 h-4 shrink-0 transition-transform group-hover:scale-110',
                          isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                        )}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.badge && (
                      <Badge
                        variant={item.badgeVariant || 'default'}
                        className="text-[10px] px-1.5 py-0 h-4"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Quick Staff Switcher & System Status */}
      <div className="p-3 border-t border-sidebar-border space-y-2 bg-sidebar/50">
        <Link
          href="/staff/deliveries"
          className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border border-border/80 bg-card/60 hover:bg-muted/80 text-foreground transition-colors group"
        >
          <div className="flex items-center gap-2">
            <Icons.delivery className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
            <span>Staff Delivery App</span>
          </div>
          <Icons.forward className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[10px]">v1.0.4 Online</span>
          </div>
          <span className="font-medium text-muted-foreground/80">RDS Live</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
          />

          {/* Drawer panel */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-background shadow-2xl z-10 slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
