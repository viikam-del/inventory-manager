# Project Version Manifest

## v4.0.0 - Milestone
**Date:** 2025-09-25
**Status:** Stable / Audit Passed

### Key Features & Fixes in v4
- **Comprehensive Audit Passed**: All system links, logic chains, and UI connections verified.
- **Soft-Deletion Enforced**: `.eq('is_deleted', false)` implemented across all detail and list views.
- **Action Suite Implementation**:
    - WhatsApp sharing (`wa.me`) and Print/PDF (`window.print()`) integrated into all core detail pages.
- **Staff Mobile Portal**: Functional PIN-based login and Delivery management interface.
- **Dashboard Analytics**: Real-time tracking of low stock, P&L, and Tally pending invoices.
- **Routing Cleanup**: Fixed broken edit links in Products, Customers, and Suppliers modules.

### Technical Stack
- **Framework**: Next.js 16.3.4 (App Router)
- **UI**: React 19, Tailwind CSS v4, Lucide React
- **Backend**: Supabase (JS Client)
- **Build Status**: Production build passes cleanly (22 routes)

---
*This version serves as the stable baseline for future UI/UX refinements.*
