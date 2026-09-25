'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const pathname = usePathname();

  // If in staff mode, hide or show minimal header
  if (pathname.startsWith('/staff')) {
    return null;
  }

  // Generate dynamic breadcrumb segments
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbItems = pathSegments.map((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/');
    const title = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return { title, href, isLast: index === pathSegments.length - 1 };
  });

  return (
    <header className="sticky top-0 z-20 h-16 w-full border-b border-border/60 bg-background/80 backdrop-blur-md transition-colors">
      <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left Side: Mobile Hamburger & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileMenuToggle}
            className="md:hidden h-9 w-9 text-muted-foreground"
            aria-label="Toggle navigation menu"
          >
            <Icons.menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href="/dashboard"
              className="hover:text-foreground font-medium transition-colors hidden sm:inline-flex items-center gap-1"
            >
              <Icons.dashboard className="w-3.5 h-3.5" />
              <span>RDS</span>
            </Link>

            {breadcrumbItems.length > 0 && (
              <span className="text-muted-foreground/40 hidden sm:inline">/</span>
            )}

            {breadcrumbItems.map((item, index) => (
              <React.Fragment key={item.href}>
                {index > 0 && <span className="text-muted-foreground/40">/</span>}
                {item.isLast ? (
                  <span className="font-semibold text-foreground tracking-tight">
                    {item.title}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="hover:text-foreground transition-colors font-medium"
                  >
                    {item.title}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* Right Side: Quick Actions & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Add Actions Dropdown / Direct CTA */}
          <div className="hidden sm:flex items-center gap-2">
            <Button size="sm" variant="outline" asChild className="h-8 text-xs border-border/70">
              <Link href="/purchase-orders/new">
                <Icons.add className="w-3.5 h-3.5 mr-1 text-primary" />
                New PO
              </Link>
            </Button>
            <Button size="sm" asChild className="h-8 text-xs">
              <Link href="/sales-orders/new">
                <Icons.add className="w-3.5 h-3.5 mr-1" />
                New Order
              </Link>
            </Button>
          </div>

          <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />

          {/* Theme Toggle Button */}
          <ThemeToggle />

          {/* User/Org Profile Pill */}
          <div className="flex items-center gap-2 pl-1 sm:pl-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              AD
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-foreground leading-none">Admin</span>
              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">RDS Central</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
