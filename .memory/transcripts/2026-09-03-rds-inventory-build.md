# Transcript: RDS Inventory Manager — Initial Build
Date: 2026-09-03
Project: RDS Inventory Manager (`D:\Claude projs\VE\RDS\inventory-manager`)
Duration: ~2 hours across one pre-compaction session

## Summary
Spec'd, scaffolded, and started building a 12-feature inventory/sales/payments PWA for a Kolkata B2B DTF/UV dealer. Wrote full Postgres schema (18 tables), seeded 13 DTF products, scaffolded Next.js 16 with Supabase, and built Products CRUD UI. Dev-server boot blocked by a stale `next dev` process that Git Bash on Windows cannot kill.

## Key Decisions
- App does NOT replace Tally Prime — Tally stays the GST invoice system. App tracks SO → delivery → invoice status with a free-text Tally ref.
- SO-first, not invoice-first. Staff creates SO at delivery time. This kills "forgot to invoice".
- Two prices per product (`price_gst`, `price_non_gst`); customer has `is_gst` boolean to pick which.
- Soft delete everywhere (`is_deleted` + `deleted_at`); no FK constraints (per project rule).
- Bilingual EN/HI via `next-intl`.
- Staff = 4-digit PIN only, separate `staff_users` table from owner `auth.users`.

## Failed Approaches
- `create-next-app` in folder with space → renamed to `inventory-manager`.
- `npm install` EALLOWSCRIPTS → fixed with `.npmrc` allow-scripts=true.
- CommonJS/ESM conflict → fixed with `"type": "module"` in package.json.
- `taskkill` in Git Bash on Windows → fails on paths with spaces; need Task Manager or `npx kill-port`.
- `'use client'` + `export const metadata` in layout.tsx → Next.js 16 will throw; need to split.

## Discoveries
- Next.js 16 auto-writes `AGENTS.md` warning "This is NOT the Next.js you know" + instructs to read `node_modules/next/dist/docs/`. Easy to miss.
- `@supabase/auth-helpers-nextjs` is installed but for client components, direct `@supabase/supabase-js` is simpler.
- The navbar's "Sign in" / "Sign up" links point to `/api/auth/...` (API route handlers) instead of `/signin` / `/signup` (page routes) — needs fixing.

## Search Keywords
RDS inventory, DTF printer dealer, Kolkata B2B, sales order first, Tally integration, Supabase schema, Next.js 16 metadata client component, taskkill Git Bash Windows, soft delete, stock adjustments audit, 18% GST India, CGST SGST IGST, 4-digit PIN PWA, forgot to invoice
