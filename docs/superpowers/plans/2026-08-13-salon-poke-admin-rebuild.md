# Salon Poke Bristol Admin Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduce the live Salon Poke public site in a Git-backed Next.js application and provide a secure six-module Supabase admin.

**Architecture:** Keep the existing Next.js App Router and hardened server-side Supabase patterns, replace Pandora-specific public and operational features with Salon Poke routes and focused modules, and use versioned RLS-protected migrations. Deploy to Vercel Preview before production promotion.

**Tech Stack:** Next.js 16, React 18, Supabase Auth/Postgres/Storage, Node test runner, Vercel.

## Global Constraints

- Preserve the current production deployment until Preview verification passes.
- Interpret booking times in `Europe/London`.
- Never expose a Supabase service-role key to browser code.
- Admin authorization comes from `admin_users`, never user-editable metadata.
- Keep only appointments, services, schedule, gallery, site content, and administrator management in the admin UI.

---

### Task 1: Freeze the live-site content inventory

**Files:**
- Create: `docs/live-site-inventory.md`
- Create: `content/salon-poke-defaults.js`
- Test: `tests/content-defaults.test.mjs`

**Interfaces:**
- Produces: `salonDefaults`, the typed-by-shape fallback document consumed by public pages and the seed migration.

- [ ] Write a failing Node test asserting required identity, route, service, contact, and gallery fields.
- [ ] Capture visible copy, links, service prices, route names, and public image URLs from the live deployment.
- [ ] Implement `content/salon-poke-defaults.js` with the captured data.
- [ ] Run `node --test tests/content-defaults.test.mjs` and require PASS.
- [ ] Commit with `feat: capture Salon Poke public content`.

### Task 2: Replace the public application shell and pages

**Files:**
- Modify: `app/layout.js`, `app/globals.css`, `app/page.js`
- Modify: `app/components/Navbar.js`, `app/components/MobileNav.js`, `app/components/Footer.js`
- Create/replace: `app/services/page.js`, `app/booking/page.js`, `app/gallery/page.js`, `app/about/page.js`, `app/location/page.js`, `app/contact/page.js`, `app/terms/page.js`, `app/privacy/page.js`
- Test: `tests/public-routes.test.mjs`

**Interfaces:**
- Consumes: `salonDefaults`.
- Produces: all preserved public routes and shared `SiteContentProvider` behavior.

- [ ] Write route/source tests that fail while Pandora branding or required routes remain.
- [ ] Build the Salon Poke layout, responsive navigation, page sections, and accessible fallback image presentation.
- [ ] Remove public links to products, tickets, coupons, Stripe, and Pandora operations.
- [ ] Run public route tests and `npm run build`; require PASS.
- [ ] Commit with `feat: rebuild Salon Poke public site`.

### Task 3: Introduce the focused Supabase schema and RLS

**Files:**
- Create: `supabase/migrations/20260813000100_salon_poke_core.sql`
- Create: `supabase/migrations/20260813000200_salon_poke_rls_storage.sql`
- Create: `supabase/seed-salon-poke.sql`
- Test: `tests/schema-security.test.mjs`

**Interfaces:**
- Produces: `profiles`, `admin_users`, `services`, `appointments`, `business_hours`, `blocked_dates`, `gallery_images`, `site_content`, and `admin_audit_logs`.

- [ ] Write SQL source tests for RLS, policy predicates, final-admin protection, storage policy scope, status constraints, and London-time availability inputs.
- [ ] Add idempotent schema with indexes, constraints, triggers, and audit primitives.
- [ ] Add explicit anonymous published reads, customer-owned appointment reads, and admin CRUD policies.
- [ ] Seed live Salon Poke services, hours, and site content.
- [ ] Run schema tests and Supabase security advisors against the connected project; require no unresolved critical finding.
- [ ] Commit with `feat: add Salon Poke database and RLS`.

### Task 4: Implement auth, booking, and availability

**Files:**
- Modify: `lib/supabase/server.js`, `lib/supabase/browser.js`, `proxy.js`
- Create: `lib/auth/admin.js`, `lib/booking/salon-availability.js`, `lib/validation/salon.js`
- Create/replace: `app/signin/page.js`, `app/signup/page.js`, `app/account/page.js`, `app/auth/callback/route.js`
- Create: `app/api/availability/route.js`, `app/api/appointments/route.js`
- Test: `tests/availability.test.mjs`, `tests/admin-auth.test.mjs`, `tests/appointment-validation.test.mjs`

**Interfaces:**
- Produces: `requireAdmin()`, `getAvailability(date, serviceId)`, and validated appointment GET/POST endpoints.

- [ ] Write failing tests for DST, closures, overlap, validation, ordinary-user denial, and admin acceptance.
- [ ] Implement minimal validated functions and server routes.
- [ ] Implement sign-in, sign-up, callback, and customer account screens with safe redirects.
- [ ] Run targeted tests and build; require PASS.
- [ ] Commit with `feat: add secure Salon Poke booking and auth`.

### Task 5: Build the six-module admin

**Files:**
- Replace: `app/admin/page.js`, `app/admin/login/page.js`
- Create: `app/admin/AdminShell.jsx`
- Replace or create components under `app/components/admin/` for Appointments, Services, Schedule, Gallery, Site Content, and Administrators.
- Create: focused route handlers under `app/api/admin/appointments`, `services`, `schedule`, `gallery`, `site-content`, and `administrators`.
- Test: `tests/admin-modules.test.mjs`

**Interfaces:**
- Consumes: `requireAdmin()` and the core tables.
- Produces: six named admin modules with audited CRUD routes.

- [ ] Write failing source and route-contract tests for every module and final-admin protection.
- [ ] Implement protected admin shell and module navigation.
- [ ] Implement validated CRUD handlers and audit logging.
- [ ] Implement accessible loading, empty, success, confirmation, and error states.
- [ ] Run admin tests, full tests, security scan, and build; require PASS.
- [ ] Commit with `feat: add focused Salon Poke admin`.

### Task 6: Import assets and operational documentation

**Files:**
- Create/update: `public/images/salon-poke/*`
- Modify: `.env.example`, `README.md`
- Create: `docs/ADMIN_OPERATIONS.md`, `docs/DEPLOYMENT.md`

**Interfaces:**
- Produces: locally controlled public assets and exact environment/bootstrap instructions.

- [ ] Download and verify current public assets with stable filenames and meaningful alt text mappings.
- [ ] Document required variables, migration order, initial admin bootstrap, backup, rollback, and routine admin use.
- [ ] Confirm secrets and generated output are excluded by `.gitignore`.
- [ ] Run full tests, build, security scan, and production dependency audit.
- [ ] Commit with `docs: add Salon Poke operations and deployment guide`.

### Task 7: Preview deployment and end-to-end verification

**Files:**
- Modify only when verification exposes a reproducible defect.

**Interfaces:**
- Produces: a READY Vercel Preview deployment linked to the branch.

- [ ] Configure Preview environment variables and apply migrations to the user-controlled Supabase project.
- [ ] Create the initial Auth user and controlled `admin_users` row without committing credentials.
- [ ] Deploy Preview and inspect build/runtime logs.
- [ ] Browser-test public routes, responsive layout, booking, sign-in protection, all six admin modules, and ordinary-user rejection.
- [ ] Fix defects test-first and repeat until the full flow passes.
- [ ] Commit verification fixes independently.

### Task 8: Git/Vercel production cutover

**Files:**
- No expected application changes.

**Interfaces:**
- Produces: GitHub-hosted source, Git-connected Vercel project, healthy production alias, and rollback evidence.

- [ ] Push `codex/salon-poke-admin-rebuild` and open a draft PR with test and Preview evidence.
- [ ] Confirm repository default branch policy and merge using the approved GitHub workflow.
- [ ] Connect the Vercel project to `PANDORASPA/Hair-salon` and verify production variables.
- [ ] Promote the verified artifact or deploy the merged commit to Production.
- [ ] Repeat public/admin smoke tests and inspect production error logs.
- [ ] Record production deployment ID and previous rollback candidate in the handoff report.
