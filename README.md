# RDS Inventory Management

## Overview

RDS Inventory is a comprehensive inventory and operations management system for Rainbow Digital Solutions (RDS), a B2B dealer of large-format printers (DTF, UV) and consumables based in Kolkata, India.

The system replaces paper-based order tracking and eliminates the "forgot to invoice" problem while providing real-time visibility into sales, customers, stock, payments, and supplier operations.

## Features

### Core Features (MVP)
- **Product Management**: SKUs, stock levels, pricing, low-stock alerts
- **Customer Management**: Contact info, credit terms, outstanding balances
- **Supplier Management**: Supplier details, purchase orders, receipts
- **Sales Orders**: Create, confirm, deliver, invoice tracking
- **Payments**: Record customer payments, auto-apply to invoices
- **Reminders**: Auto-generated (due payments, low stock, follow-ups) + manual creation
- **Dashboard**: Real-time KPIs and insights
- **Reports**: Sales, profit, stock, outstanding dues, payables
- **Settings**: Company info, defaults, notifications, user management

### Key Differentiators
- **No duplicate invoicing**: Integrates with Tally for official GST invoices
- **Staff-friendly**: Phone-optimized UI for delivery staff (4-digit PIN)
- **Free stack**: Built on Next.js + Supabase + Vercel (all free tier)
- **WhatsApp integration**: Pre-filled payment reminders and customer re-engagement
- **Hindi + English**: Local language support
- **PWA**: Installable as mobile app for old Android phones

### User Roles
- **Owner**: Full access to all features via desktop
- **Staff/Delivery**: Delivery-only access via phone (PWA)

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account (free)
- Git

### Setup

```bash
# Clone this repository
git clone <repository-url>
cd inventory-manager

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# (see .env.example for required variables)

# Start the development server
npm run dev
```

## Features Overview

### Product Management
- Create, edit, delete products
- Manage stock levels with alerts
- Import/export products via CSV

### Customer Management
- Track customer info, GST status, credit limits
- Manage outstanding balances and payment history
- Send automated payment reminders via WhatsApp

### Sales Orders
- Create sales orders from customer requests
- Track order status: Draft → Confirmed → Partially Delivered → Delivered → Invoiced → Cancelled
- Staff sees confirmed orders on their dashboard for delivery

### Payments
- Record customer payments
- Auto-apply to oldest unpaid invoices
- Generate PDF receipts for WhatsApp sharing

### Reminders
- Auto-generated: payment due, low stock, follow-ups, overdue deliveries
- Manual reminders for custom alerts
- WhatsApp integration for customer re-engagement

### Dashboard
- Real-time KPIs and business insights
- Date range filters (Today / Week / Month / Quarter / Year)
- Mobile-responsive design
- Quick actions for common tasks

### Reports
- Sales reports (by date, product, customer)
- Profit analysis
- Stock reports
- Outstanding dues and payables reports
- Customer re-engagement lists
- CSV export for all reports

### Settings
- Company information (logo, address, GSTIN)
- Notification preferences
- User management and PIN settings
- Language preferences (English/Hindi)

### Staff Interface (Delivery Person)
- Phone-optimized PWA
- Simple interface for viewing today's deliveries
- Mark deliveries as completed or partial
- View delivery history
- Receive notifications

## Architecture

### Frontend
- **Framework**: Next.js 14 (App Router)
- **State Management**: React Context + TanStack Query
- **Routing**: Next.js file-system routing
- **Styling**: Tailwind CSS
- **Charts**: Recharts + custom SVG sparklines
- **PWA**: Installed via next-pwa
- **Internationalization**: next-intl (English/Hindi)

### Backend
- **Database**: PostgreSQL (Supabase)
- **API**: Supabase Edge Functions (REST)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage for logos, receipts

### Tech Stack
- React/Next.js
- TypeScript
- Tailwind CSS
                        
- PostgreSQL (Supabase)
- Vercel (deployment)
- ShadCN UI (component library)

## Development Workflow

1. **Feature Planning**: Each feature is broken into tasks with clear acceptance criteria
2. **Testing**: Unit tests for components, integration tests for business logic
3. **Review**: Peer review before merging to main
4. **Deployment**: Vercel preview deployments for feature branches
5. **QA**: Manual testing with real users (Owner + Staff)

## Local Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Deployment

The project uses Vercel for deployment. After pushing to GitHub, the Vercel integration automatically builds and deploys preview URLs for each branch and production URLs for the main branch.

## Support

For support, please contact:
- Email: rds.inventory.support@gmail.com
- Phone: +91-98765-43210

## Changelog

### v1.0.0 (2026-09-02)
- Initial MVP release
- Core features implemented
- Documentation complete

## Contributing

Contributions are welcome! Please follow the code of conduct and contribute with constructive feedback.

## License

This project is licensed under the MIT License.

---

*Built with ❤️ using the Spartan AI Toolkit and Claude Code*
*For more information, visit [Spartan AI Toolkit](https://github.com/spartan-stratos/spartan-ai-toolkit)*