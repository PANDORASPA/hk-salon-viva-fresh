# Architecture — SALON POKE BY VIVA

## Stack

- **Frontend / Backend**: Next.js 16 (App Router) + React 18, all in one repo
- **Database**: Supabase (PostgreSQL 15) with RLS
- **Auth**: Supabase Auth (email + password, magic link optional)
- **Hosting**: Vercel (recommended); any Node.js ≥ 20 host works
- **Tests**: `node --test` (built-in test runner)

## High-Level Diagram

```
                        ┌──────────────────────────────────────┐
                        │            Browser                   │
                        │  - RSC pages                         │
                        │  - /api/* fetch (RSC + client)       │
                        └──────────────┬───────────────────────┘
                                       │
                                       ▼
              ┌────────────────────────────────────────────────────┐
              │   Vercel Edge / Node runtime                       │
              │   Next.js 16 App Router                            │
              │   ┌──────────────────────────────────────────────┐  │
              │   │  proxy.js → /account + /admin auth gate    │  │
              │   │  app/* (RSC + client components)            │  │
              │   │  app/api/* (Route Handlers)                 │  │
              │   │  lib/booking/package-usage.js (RPC wrapper) │  │
              │   └──────────────────┬───────────────────────────┘  │
              └──────────────────────┼──────────────────────────────┘
                                     │
                                     ▼
                ┌────────────────────────────────────────────┐
                │   Supabase (khjjvjufwbmqymgzhbkl)         │
                │                                            │
                │   Auth → JWT in httpOnly cookie             │
                │   Postgres + RLS policies                   │
                │   Storage (gallery bucket)                  │
                │                                            │
                │   Tables (canonical):                       │
                │     profiles, appointments, services,       │
                │     customers, customer_packages,           │
                │     packages, package_services,             │
                │     package_redemptions, admin_users,       │
                │     admin_audit_logs, site_content          │
                │                                            │
                │   RPCs:                                    │
                │     redeem_customer_package(bigint, bigint) │
                │     refund_customer_package(bigint, bigint) │
                └────────────────────────────────────────────┘
```

## Data Model (canonical)

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (= auth.users.id), `full_name`, `phone` | 1-to-1 with `auth.users` |
| `customers` | `id`, `name`, `phone`, `email` | Public customers (no auth required) |
| `appointments` | `id`, `customer_id`, `user_id`, `service_id`, `starts_at`, `status`, `customer_package_id` | Single source of truth for bookings |
| `services` | `id`, `name`, `price`, `duration_minutes`, `published`, `enabled`, `sort_order` | Display + booking flow |
| `packages` | `id`, `name`, `total_sessions`, `validity_days`, `price_hkd`, `is_active`, `colour_hex` | Templates |
| `customer_packages` | `id`, `customer_id`, `package_id`, `total_sessions`, `sessions_remaining`, `is_active`, `expires_at` | Issued to a customer |
| `package_redemptions` | `id`, `customer_package_id`, `appointment_id`, `redeemed_at`, `refunded_at` | One row per appointment that consumed a slot |
| `admin_users` | `user_id`, `is_active`, `created_by` | Admin gate (NOT `member_profiles.is_admin`; that pattern is from an older draft setup order, not deployed) |
| `admin_audit_logs` | `actor_user_id`, `action`, `target_table`, `target_id`, `before_data`, `after_data`, `ip`, `user_agent` | Every admin write |
| `site_content` | `data` (JSONB: `{ identity, contact, business }`) | Editable from `/admin` |

> **Note**: An older `SUPABASE_SETUP_ORDER.md` in the repo describes a 13-file
> migration set that uses `member_profiles` + `bookings` instead. That setup
> order is **not the deployed schema** — the live project uses the 4 migrations
> in `supabase/migrations/`. See `docs/supabase-setup-order.md` for context.

## Package / Ticket Loop

```
[Admin] /admin → Packages tab
   ↓  assigns `customer_packages` row
[Customer] /booking → enters phone
   ↓  GET /api/customers?phone=...
   ↓  receives their `customer_packages` (filtered usable)
[Customer] picks a package
   ↓  POST /api/appointments  { customerPackageId, ... }
[Server] calls `applyRedemption()`
   ├─ preferred:  RPC `redeem_customer_package(p_customer_package_id, p_appointment_id)`
   │              — atomic: FOR UPDATE on package, decrement, insert package_redemptions
   └─ fallback:   two-step write guarded by RLS + unique(appointment_id) on package_redemptions
[Customer] /account → cancels
   ↓  PATCH /api/account/bookings/[id]  status = 'cancelled'
[Server] calls `reverseRedemption()`
   ├─ preferred:  RPC `refund_customer_package(...)`
   └─ fallback:   delete package_redemptions row + increment sessions_remaining (capped at total)
```

## Auth / Routing

- `proxy.js` (Next.js 16 name for middleware) reads the Supabase auth cookie:
  - `/account/*` → must be logged in (redirect to `/signin?redirectTo=...`)
  - `/admin/*` (except `/admin/login`) → must have `admin_users.is_active = true`
- `lib/supabase/server.js` returns a per-request `createServerClient` with
  cookie sync. Used inside RSC + route handlers.
- `lib/supabase/browser.js` returns a singleton `createBrowserClient` for
  client components and form posts.
- `lib/supabase/admin.js` exposes `getAdminState()` + `requireAdmin()` for
  server components (e.g. `app/admin/page.js`).
- `lib/admin-audit.js` exposes `writeAdminAuditLog()` + `tryWriteAdminAuditLog()`;
  every admin write route wraps its handler with the try variant.

## Testing Strategy

| Layer | What | Where |
|---|---|---|
| Pure functions | `lib/time.js`, `lib/format.js` | inline assertions in `tests/*.test.mjs` |
| Code-shape | Booking form submits correct shape, etc. | `tests/booking-form.test.mjs` |
| Auth | proxy.js redirects unauthenticated `/admin` → `/admin/login` | `tests/admin-auth.test.mjs` |
| Content | `salon-poke-defaults` exports valid shape | `tests/content-defaults.test.mjs` |
| Schema security | No `service_role` key in client, env names follow convention | `tests/schema-security.test.mjs` |
| Repository hygiene | No leftover `PANDORA HEAD SPA` / `VIVA Hair` / `member_profiles` references | `tests/repository-hygiene.test.mjs` |

E2E / smoke tests are NOT in this repo yet. They were previously run as ad-hoc
shell scripts (see `LIVE_SMOKE_REPORT_*.json` gitignored) and tracked in
`docs/phase2-smoke-checklist.md`.

## File Map

```
app/
  page.js                       Home
  layout.js                     Root layout, font preconnect, metadata
  globals.css                   Design tokens + components
  sitemap.js, robots.js         SEO
  booking/
    page.js                     Server component, loads services
    BookingForm.jsx             Client form (phone lookup → package → service → slot → submit)
    confirm/page.js             Confirmation page
  account/                      Member self-service
  admin/                        Admin shell + login
  api/
    availability/route.js       GET slots
    appointments/route.js       POST create
    appointments/[id]/ics/route.js   GET .ics
    customers/route.js          GET lookup
    packages/route.js           GET templates
    admin/*                     Admin CRUD
  components/
    Footer.js, Navbar.js, AuthForm.js, RouteBodyClass.js, PageIntro.js
    admin/SalonAdminModules.jsx     (8 modules in one file — candidate for split)
    admin/SalonCustomerModules.jsx  (Customers + Packages — candidate for split)

lib/
  supabase/{server,browser,admin,service}.js   Supabase client factories
  admin-audit.js                                Audit log writer
  time.js                                       Time parsing helpers
  format.js                                     Date / price / ICS formatters
  booking/
    package-usage.js                            Redemption + refund wrapper
    availability.js                              Slot computation
    admin-schedule.js                           Admin schedule helpers
    phase2.js                                   Multi-location / resource rules
  validation/                                    Input validation
  content/                                      Sanitisation (RSC-safe HTML)

content/
  salon-poke-defaults.js                        Hardcoded fallback when DB is empty

supabase/
  migrations/                                   Canonical SQL
  seed-salon-poke.sql                           Demo seed (renamed from .bak)

docs/                                           This folder

tests/                                          node --test
```

## Conventions

- Use `<Link>` for internal navigation
- Do not use inline `font:` shorthand — break into `font-weight / font-size / line-height / font-family`
- All package mutations go through `lib/booking/package-usage.js`
- All admin writes call `tryWriteAdminAuditLog({ action, beforeData, afterData })`
- RSC components call `getServerClient()` per request
- Client components use `getBrowserClient()` singleton
- Server routes can use `getServerClient()` or a service-role client (admin only)
- All user-facing copy is **Traditional Chinese (zh-HK)**
