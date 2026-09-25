'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // If in staff mode, bypass SaaS sidebar and render clean focused layout
  const isStaffRoute = pathname.startsWith('/staff');

  if (isStaffRoute) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Sidebar Component */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area (Offset for Desktop Sidebar) */}
      <div className="flex-1 flex flex-col md:pl-64">
        <Header onMobileMenuToggle={() => setMobileSidebarOpen((prev) => !prev)} />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
