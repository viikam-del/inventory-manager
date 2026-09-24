# Session Handoff: RDS Inventory Manager — Initial Build

Created: 2026-09-03 01:21
Project: `D:\Claude projs\VE\RDS\inventory-manager`
Author: Vishal (owner, Rainbow Digital Solutions, Kolkata — B2B dealer of DTF/UV large-format printers and consumables)
Stack: Next.js 16.3.4 (App Router) + TypeScript + Tailwind v4 + Supabase (Postgres/Auth/Storage) + Vercel (free)
Currency: ₹ (INR) · 18% GST (CGST+SGST or IGST) · Bilingual EN/HI (next-intl)

## What We Were Building
A 12-feature inventory + sales + payments + reminders PWA for a 2-person B2B dealer. The killer problem to solve is "forgot to invoice" — owner is often off-site when delivery happens, so the system must record the SO/delivery first and let invoicing be a separate step (Tally Prime stays the source of GST invoices; this app does NOT replace invoicing — it tracks the in-app invoice reference). Free tier throughout. Staff (delivery person, old Android phone, non-tech) uses 4-digit PIN PWA, sees only delivery-relevant data with no typing.

## Session Progress

### Completed ✅
- Full product spec written and locked with the user: `.planning/PRODUCT_SPEC.md` (12 sections — personas, feature list, data model, SO-first flow, payment rules, reminders, dashboard, PWA staff view, i18n, security, free-tier, non-goals).
- Database schema: `database/schema.sql` — 18 tables: `segments`, `categories`, `sub_categories`, `products`, `customers`, `suppliers`, `purchase_orders`, `purchase_order_lines`, `receipts`, `receipt_lines`, `sales_orders`, `sales_order_lines`, `payments`, `stock_adjustments`, `customer_returns`, `customer_return_lines`, `supplier_returns`, `supplier_return_lines`, `reminders`, `company_settings`. Triggers for `updated_at`, partial indexes for soft-deletes, RLS-friendly design (no FK constraints, app enforces).
- Seed data: `database/seed.sql` — 1 segment (DTF), 3 categories (Inks, Films, Powders), sub-categories, and 13 DTF products with realistic prices.
- Next.js 16.3.4 project scaffolded with App Router, TypeScript, Tailwind v4. Dependencies: `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`, `next-intl`, `date-fns`, `zustand`. `"type": "module"` set in `package.json`. `.npmrc` with `allow-scripts=true`.
- `src/lib/supabase.ts` — Supabase client.
- `src/components/navbar.tsx` — top nav with auth state, links to all main pages. **`'use client'`**.
- `src/app/layout.tsx` — root layout. **`'use client'`** added (problematic — see Risks).
- `src/app/page.tsx` — redirect to `/dashboard` or `/signin`. **`'use client'`**.
- `src/app/dashboard/page.tsx` — 4 KPI cards (Total Products, Low Stock, Total Customers, Outstanding ₹). Fetches counts from Supabase.
- `src/app/products/page.tsx` — Products list with table, low-stock badges, delete.
- `src/app/products/new/page.tsx` — New product form with all fields including segment/category/sub-category.
- `src/app/api/auth/signin/route.ts` — POST handler using `supabase.auth.signInWithPassword`.

### In Progress 🔨
- Trying to start the dev server (`npm run dev`). Last successful start was at `http://localhost:3004` before compaction.
- Resolving `taskkill` failures on Windows Git Bash (cannot kill stale `next dev` process holding the port).

### Stopped at
- Was attempting to verify the dev server starts cleanly after the `'use client'` directive fixes to `layout.tsx`, `page.tsx`, `navbar.tsx`. Did not get to confirm a clean start before compaction.

## Resume Instructions
To pick up immediately:
1. Open `D:\Claude projs\VE\RDS\inventory-manager` in a fresh terminal.
2. **Resolve the dev-server issue FIRST** (see "Immediate Next Step" below).
3. Once dev server is up, follow the build order in "Next Features" — start with **Sign-in/Sign-up pages** (the only auth UI missing), then **Customers CRUD** (highest business value after Products).
4. Goal for next session: end with working `/signin`, `/customers`, `/customers/new`, `/customers/[id]` (detail with ledger placeholder) and a verified dev server boot.

### Immediate Next Step (the blocker)
The stale `next dev` process is the only thing between us and a clean build verification. Try in order — stop on first success:
1. Open **Task Manager** → Details tab → find any `node.exe` running with command line containing `next dev` → End Task. Retry `npm run dev`.
2. If user is in a hurry, just `npx kill-port 3004 3000 3001 3002 3003` (or whatever port Next reports last) from a separate terminal. If `kill-port` is not installed, `npx kill-port 3000-3010`.
3. Last resort: change `next dev` script to a fixed port that nothing is using: `"dev": "next dev -p 4321"`. Commit that change. Restart.

If `npm run dev` still fails on layout.tsx, see "Known Risks" #1 (split the layout).

## Next Features (in build order)
| # | Feature | Route(s) | Why this order |
|---|---------|----------|----------------|
| 1 | Sign-in / Sign-up pages | `src/app/signin/page.tsx`, `src/app/signup/page.tsx` | No other auth-gated page is usable without these. |
| 2 | Customers CRUD | `src/app/customers/page.tsx`, `new/`, `[id]/page.tsx` | Highest business value after Products — owner needs the B2B customer base to start writing SOs. |
| 3 | Suppliers CRUD | `src/app/suppliers/page.tsx`, `new/`, `[id]/page.tsx` | Mirror of Customers; needed before Purchase Orders. |
| 4 | Purchase Orders + Receipts | `src/app/purchase-orders/page.tsx`, `new/`, `[id]/page.tsx` | Stock only grows via Receipts; receipts are needed before Sales Orders can decrement inventory. |
| 5 | Stock Adjustment log | `src/app/stock-adjustments/page.tsx` | Audit trail for manual corrections. |
| 6 | **Sales Orders** (core SO-first flow) | `src/app/sales-orders/page.tsx`, `new/`, `[id]/page.tsx` | THE primary feature — the "forgot to invoice" killer. |
| 7 | Invoice tracking (Tally ref) | inside `[id]/page.tsx` for SO | A checkbox + free-text Tally invoice number, plus a "Pending Invoicing" filter on the list. |
| 8 | Payments (record, partial, FIFO auto-apply) | `src/app/payments/page.tsx`, `new/`, customer detail | FIFO across customer's open SOs. |
| 9 | Customer & Supplier Returns | `src/app/customer-returns/`, `supplier-returns/` | Return against a delivery or PO; restock or write-off decision. |
| 10 | Reminders engine | `src/app/reminders/page.tsx`, scheduled job | Daily digest for owner; low-stock push for staff. |
| 11 | Staff PWA | `src/app/staff/...` + `public/manifest.json` + service worker | 4-digit PIN login, SO list, mark-as-delivered, see only stock numbers. No typing. |
| 12 | Dashboard polish + Reports + Settings | dashboard + `src/app/reports/*` + `src/app/settings/page.tsx` | All KPIs, 12 reports, GST vs non-GST split, Hindi toggle. |

## Key Decisions Made This Session
- **App does NOT replace Tally.** Tracks SO → delivery → invoice status only. Tally stays the GST invoice system of record. A Tally invoice # field on each SO closes the loop.
- **SO-first, not invoice-first.** Office staff creates SO at the time of delivery (the moment the inventory leaves the shelf). Invoice (Tally ref) is added later by the owner. This kills "forgot to invoice".
- **Two prices per product**: `price_gst` (for GST customers) and `price_non_gst` (for non-GST customers). Both stored; selected at SO line item time. GST rate is 18%, both local (CGST+SGST 9+9) and inter-state (IGST 18).
- **Soft delete everywhere** with `is_deleted` + `deleted_at`. No hard delete from UI.
- **No FK constraints** at DB layer (per project rule `SCHEMA.md`). All relationships enforced in app.
- **`is_deleted` (boolean) AND `deleted_at` (timestamptz) on every table** — both fields used (boolean for fast filtering, timestamp for audit/partial indexes).
- **Bilingual EN/HI** via `next-intl`. Default English; Hindi toggle in Settings.
- **Staff auth = 4-digit PIN**, scoped to a single `staff_users` table separate from owner `auth.users`. PIN is the *only* auth factor for staff (no email/password).
- **All currency in ₹** (Indian Rupee symbol), formatted with `toLocaleString('en-IN')` for the lakh/crore grouping.
- **Free tier discipline**: Supabase free tier (500MB DB, 50k MAU), Vercel hobby, no paid services. Push notifications later if at all — start with in-app digest + email if Supabase SMTP can be configured cheaply.

## Things Tried That Didn't Work
- **`create-next-app` in a folder with a space** ("Inventory Manager"). npm rejected the project name. **Fix**: renamed folder to `inventory-manager` (lowercase, no space).
- **`npm install` EALLOWSCRIPTS error**. Windows PowerShell execution policy blocked lifecycle scripts. **Fix**: `npm config set allow-scripts true` + `.npmrc` with `allow-scripts=true`.
- **CommonJS / ESM conflict**. `package.json` had `"type": "commonjs"` from a stray `npm init -y`, conflicting with `import/export` syntax. **Fix**: `npm pkg set type="module"`.
- **React Server Component errors** (`useEffect`/`useState`/`useRouter` in server component). **Fix**: added `'use client'` directive to `layout.tsx`, `page.tsx`, `navbar.tsx`. **CAVEAT**: layout.tsx now has `'use client'` *and* `export const metadata` — Next.js 16 will throw on this. See Risks.
- **`taskkill` in Git Bash on Windows**. The path-with-spaces argument parsing breaks; PowerShell `Stop-Process` from Git Bash also fails. **Workaround**: use Task Manager, or `npx kill-port`. See Immediate Next Step.

## Critical Context
- **Business model constraints** baked into the data model:
  - Each customer has `gst_number` (nullable) and `is_gst` boolean. Non-GST customers use `price_non_gst`; GST customers use `price_gst`.
  - Each supplier has `gst_number` (required for GST suppliers), bank details (`bank_name`, `account_number`, `ifsc`, `upi_id`) for recording payments.
  - `company_settings` table is a single-row table for the dealer's own GSTIN, address, bank details (printed on the physical copy the office guy hands over).
- **SO lifecycle states**: `draft` → `confirmed` → `partially_delivered` → `delivered` → `invoiced` → `cancelled`. The transition to `invoiced` is what closes the "forgot to invoice" loop — it's the action the owner takes once Tally is updated.
- **Default payment terms**: 7 days, overridable per-customer (`customers.default_payment_terms_days`).
- **Stock discipline**: every stock change (Receipt, SO delivery, Return, Adjustment) writes a row to `stock_adjustments` with `reason`, `quantity_delta`, `reference_type`, `reference_id`. This is the audit trail.
- **Owner-not-present reality**: SOs will be created by the staff via PWA at delivery time, often without the owner seeing the customer. The PWA must work offline-ish (read cached SOs for the day) and queue mark-as-delivered if offline.

## Known Risks / Things to Watch Out For
1. **`src/app/layout.tsx` has both `'use client'` and `export const metadata`.** Next.js 16 throws on metadata in a client component. **Action on resume**: split — create a new `src/app/layout.tsx` without `'use client'` (just metadata + body + html wrapper) and move the Navbar into a `<NavbarClient>` wrapper in `src/app/navbar-client.tsx` (or inline the `'use client'` into navbar.tsx which it already has, then call `<Navbar />` from server layout). Verify by restarting dev server.
2. **Navbar links to `/api/auth/signin` and `/api/auth/signup`** (line ~100, 112-114, 119-122 of `navbar.tsx`). These are API route handlers, not pages. The links will hit the JSON API and confuse the user. **Action on resume**: change navbar links to `/signin` and `/signup` (page routes — those don't exist yet; create them in step 1).
3. **Next.js 16 is "NOT the Next.js you know"** — see `AGENTS.md` auto-generated note in repo root. `useRouter` from `next/navigation` and the `'use client'` directive work, but there may be other API breaks. **Action on resume**: before writing the Sign-in page, read `node_modules/next/dist/docs/01-app/` for the current auth client and middleware patterns. Do NOT trust memory of Next.js 13/14.
4. **Stale dev server** on port 3004 is currently the only thing blocking end-to-end verification. If unfixable, the next agent should re-author the `dev` script to a fixed high port (`next dev -p 4321`).
5. **`@supabase/auth-helpers-nextjs` is installed** but not yet wired up. For client-side auth in v16, `@supabase/supabase-js` direct usage (as in `page.tsx`) is the simpler path. Skip `auth-helpers` unless we need server components reading the session. Revisit at the PWA staff auth step.
6. **No `.env.local` real values yet.** The user has to create a Supabase project at https://supabase.com and paste the URL + anon key into `.env.local` before anything will work. **First user-facing question on resume** (after dev server is up): "Can you paste your Supabase URL and anon key into `.env.local`? Then I'll run the schema.sql and seed.sql against your project."
7. **RLS is not yet written.** `schema.sql` does not include Row Level Security policies. For the staff PWA, we'll need separate RLS policies (staff can read all SOs, can only INSERT `sales_order_lines` and update `sales_orders.delivery_status` for assigned SOs). Defer until staff PWA build step.
8. **Currency format**: code uses raw `₹{Number(x).toFixed(2)}` in places. Replace with a shared `formatINR()` util at `src/lib/format.ts` once the 2nd file uses it.
9. **No tests.** Per project rules this is acceptable for a solo internal tool, but the **PWA staff view** and **payment FIFO** logic both warrant a small test file at the time they're written. Don't write tests for simple CRUD pages.

## Files Modified This Session
- `package.json` (added `"type": "module"`)
- `package-lock.json` (npm install resolved)
- `.npmrc` (allow-scripts=true)
- `.env.local` (Supabase placeholders)
- `tsconfig.json`, `next.config.ts`, `postcss.config.mjs` (default scaffold)
- `database/schema.sql` (380 lines, full schema)
- `database/seed.sql` (335 lines, DTF seed)
- `src/lib/supabase.ts` (Supabase client)
- `src/app/layout.tsx` (root layout — has `'use client'`, see Risk #1)
- `src/app/page.tsx` (redirect handler)
- `src/app/dashboard/page.tsx` (4 KPIs)
- `src/app/products/page.tsx` (list + delete)
- `src/app/products/new/page.tsx` (create form)
- `src/components/navbar.tsx` (top nav)
- `src/app/api/auth/signin/route.ts` (POST signin handler)
- `AGENTS.md` (auto-written by `next dev`, not by us)
- `README.md` (project overview)

## Tests Status
- All tests passing: N/A (none written)
- Tests added: none
- Known failing tests: none

## Non-Goals (do NOT build)
- QR code / barcode scanning (defer; stick to text search for now)
- Native mobile app
- Multi-warehouse / multi-location
- Tax filing / GST return export
- Replacing Tally Prime for invoicing
- Customer self-service portal
- Real-time chat (WhatsApp IS the chat channel)
- Push notifications (start with in-app digest + email)

## One-Line Resume Prompt for Fresh Session
> Resume the RDS Inventory Manager build. Start at `D:\Claude projs\VE\RDS\inventory-manager\.handoff\2026-09-03-0121-rds-inventory-build.md`. First action: kill the stale dev server, fix the layout.tsx metadata conflict, then build the Sign-in page and Customers CRUD in that order.
