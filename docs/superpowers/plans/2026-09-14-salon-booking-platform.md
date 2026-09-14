# SALON POKE BY VIVA Booking Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-ready single-location salon system for staff-aware booking, collision prevention, customer packages, self-service, and administration.

**Architecture:** Keep `appointments` as the only booking source of truth. Next.js route handlers validate identity and input, pure domain modules calculate availability, and PostgreSQL RPCs atomically allocate staff, enforce time exclusion, and redeem or refund packages.

**Tech Stack:** Next.js 16 App Router, React, Supabase Auth and PostgreSQL, Node test runner, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-14-salon-booking-platform-design.md`

## Global Constraints

- Single location; all business-time calculations use `Asia/Hong_Kong`.
- Store money as integer HKD cents and render it as `HK$`.
- `appointments` is the sole booking table; do not connect production routes to legacy `bookings` or Phase 2 tables.
- Package ownership is derived from `auth.uid()`, never from an arbitrary browser-supplied customer id.
- Every public-schema table has RLS and explicit grants appropriate for the Supabase Data API.
- Every admin mutation revalidates active admin status, rate-limits, validates input, and writes a before/after audit record.
- Use TDD: observe every new behavior test fail for the expected reason before adding production code.
- Preserve existing user changes and avoid destructive migrations until the new flow is verified in production.
- All customer-facing operational copy is Traditional Chinese (Hong Kong); public marketing pages may retain English translations.
- Read the installed Next.js 16 documentation in `node_modules/next/dist/docs/` before modifying route or App Router conventions.

## File Structure

- `lib/booking/rules.js`: pure booking-window, working-hours, and interval rules.
- `lib/booking/availability-v2.js`: pure staff eligibility and slot matrix calculation.
- `lib/booking/errors.js`: stable error-code-to-HTTP/public-message mapping.
- `lib/booking/commands.js`: server-only wrappers for booking RPCs.
- `lib/customers/identity.js`: authenticated customer resolution.
- `app/api/availability/route.js`: public safe availability endpoint.
- `app/api/appointments/route.js`: create endpoint using the atomic command.
- `app/api/account/bookings/[id]/route.js`: authenticated reschedule and cancel commands.
- `app/api/admin/staff/**`: staff, skill, weekly-hours, and time-off administration.
- `app/booking/components/**`: focused booking-step components and state reducer.
- `app/admin/components/**`: focused dashboard, calendar, staff, customer, service, package, setting, and audit modules.
- `supabase/migrations/*_booking_staff_foundation.sql`: staff schema, appointment occupancy columns, RLS, grants, and safe backfill.
- `supabase/migrations/*_booking_commands.sql`: atomic create, reschedule, cancel, redeem, and refund functions.
- `tests/*.test.mjs`: domain, schema-contract, API-shape, security, and UI-shape tests.
- `e2e/*.spec.js`: browser acceptance flows.

---

## Milestone 1 — Booking and Database Foundation

### Task 1: Establish a Clean Baseline and Test Harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/booking-platform-baseline.test.mjs`

**Interfaces:**
- Consumes: existing `npm test`, `npm run build`, and `npm run security:scan` scripts.
- Produces: `npm run test:unit`, `npm run test:e2e`, and a baseline test documenting the canonical `appointments` model.

- [ ] **Step 1: Install existing dependencies and inspect Next.js 16 local docs**

Run:

```powershell
npm ci
Get-Content -Raw node_modules/next/dist/docs/01-app/03-api-reference/file-conventions/route.mdx
```

Expected: install succeeds and the current route-handler conventions are available locally.

- [ ] **Step 2: Write the failing baseline contract test**

```js
test('production booking routes use appointments and never legacy bookings', async () => {
  const files = await Promise.all([
    readFile('app/api/availability/route.js', 'utf8'),
    readFile('app/api/appointments/route.js', 'utf8'),
    readFile('app/api/account/bookings/[id]/route.js', 'utf8'),
  ])
  assert.ok(files.every((source) => !source.includes("from('bookings')")))
})
```

- [ ] **Step 3: Run the focused test and record the real baseline result**

Run: `node --test tests/booking-platform-baseline.test.mjs`

Expected: PASS for current production routes; if it fails, remove legacy production-route usage before proceeding and keep the failure as evidence.

- [ ] **Step 4: Add stable script names and Playwright**

Use `npm install --save-dev @playwright/test`, then set:

```json
{
  "test:unit": "node --test tests/*.test.mjs",
  "test:e2e": "playwright test",
  "test": "npm run test:unit"
}
```

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit`

Expected: all baseline unit tests pass.

```powershell
git add package.json package-lock.json tests/booking-platform-baseline.test.mjs
git commit -m "test: establish booking platform baseline"
```

### Task 2: Add Staff, Scheduling, and Occupancy Schema

**Files:**
- Create via `supabase migration new booking_staff_foundation`: `supabase/migrations/*_booking_staff_foundation.sql`
- Create: `tests/booking-staff-schema.test.mjs`
- Modify: `docs/supabase-setup-order.md`

**Interfaces:**
- Produces tables `staff`, `staff_services`, `staff_weekly_hours`, and `staff_time_off`.
- Produces appointment columns `staff_id`, `buffer_minutes`, `occupied_until`, `source`, `confirmation_token_hash`, `cancelled_at`, and `cancelled_by`.
- Produces exclusion constraint `appointments_staff_occupied_excl` for active appointments.

- [ ] **Step 1: Create the migration with the installed Supabase CLI**

Run:

```powershell
npx supabase --version
npx supabase migration new booking_staff_foundation
```

Expected: the CLI prints a version and creates exactly one timestamped migration file.

- [ ] **Step 2: Write the failing schema contract test**

```js
test('staff foundation enforces collision safety and RLS', async () => {
  const migration = await readNewestMigration('booking_staff_foundation')
  for (const table of ['staff', 'staff_services', 'staff_weekly_hours', 'staff_time_off']) {
    assert.match(migration, new RegExp(`enable row level security`, 'i'))
    assert.match(migration, new RegExp(`create table(?: if not exists)? public\\.${table}`, 'i'))
  }
  assert.match(migration, /exclude using gist/i)
  assert.match(migration, /tstzrange\s*\(starts_at,\s*occupied_until/i)
})
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `node --test tests/booking-staff-schema.test.mjs`

Expected: FAIL because the generated migration is empty.

- [ ] **Step 4: Implement the migration**

Use this core constraint, with complete table checks, foreign keys, indexes, RLS policies, and explicit grants around it:

```sql
create extension if not exists btree_gist;

alter table public.appointments
  add column if not exists staff_id bigint references public.staff(id),
  add column if not exists buffer_minutes integer not null default 15 check (buffer_minutes between 0 and 120),
  add column if not exists occupied_until timestamptz,
  add column if not exists source text not null default 'web' check (source in ('web','account','admin')),
  add column if not exists confirmation_token_hash text;

alter table public.appointments
  add constraint appointments_staff_occupied_excl
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, occupied_until, '[)') with &&
  ) where (status in ('pending','confirmed','completed'));
```

Create one active default staff row, assign all enabled services, seed weekly hours from `business_hours`, calculate `occupied_until`, and backfill non-overlapping appointments. Add a preflight query that raises a clear exception listing overlap count before enabling the constraint.

- [ ] **Step 5: Add RLS and Data API access explicitly**

Public staff reads expose only active display fields. Weekly hours are readable for availability, while time-off rows and reasons are server/admin only. Grant only the table operations each role requires; service-role server commands remain privileged.

- [ ] **Step 6: Verify migration contract and commit**

Run:

```powershell
node --test tests/booking-staff-schema.test.mjs
npm run test:unit
```

Expected: all tests pass.

```powershell
git add supabase/migrations tests/booking-staff-schema.test.mjs docs/supabase-setup-order.md
git commit -m "feat: add staff scheduling and collision schema"
```

### Task 3: Implement Pure Availability Rules

**Files:**
- Create: `lib/booking/rules.js`
- Create: `lib/booking/availability-v2.js`
- Create: `tests/availability-v2.test.mjs`

**Interfaces:**
- Produces `validateBookingWindow({ startsAt, now, minimumLeadMinutes, maximumAdvanceDays })`.
- Produces `buildStaffAvailability({ date, service, staff, weeklyHours, timeOff, appointments, businessHours, blocked, settings })`.
- Returns `{ slots: Array<{ label, iso, staffIds }>, staffAvailability: Record<string, string[]> }`.

- [ ] **Step 1: Write failing tests for the complete rule matrix**

```js
test('removes overlaps, buffer, time off, closed hours and unskilled staff', () => {
  const result = buildStaffAvailability(fixture)
  assert.deepEqual(result.staffAvailability['1'], ['2026-09-16T11:30:00+08:00'])
  assert.deepEqual(result.staffAvailability['2'], [])
  assert.deepEqual(result.slots, [{
    label: '11:30',
    iso: '2026-09-16T11:30:00+08:00',
    staffIds: [1],
  }])
})

test('rejects a slot inside minimum lead time', () => {
  assert.deepEqual(validateBookingWindow({
    startsAt: '2026-09-14T11:00:00+08:00',
    now: new Date('2026-09-14T10:00:00+08:00'),
    minimumLeadMinutes: 120,
    maximumAdvanceDays: 90,
  }), { ok: false, code: 'booking_window_invalid' })
})
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/availability-v2.test.mjs`

Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Implement minimal pure functions**

Use half-open intervals `[start, end)`, explicit `+08:00` ISO output, 30-minute default step, 15-minute default buffer, 120-minute lead time, and 90-day horizon. Derive all dates from passed `now`; never call `new Date()` inside a pure rule without an injected clock value.

- [ ] **Step 4: Verify, remove dead ambiguity, and commit**

Run: `node --test tests/availability-v2.test.mjs`

Expected: all availability cases pass.

```powershell
git add lib/booking/rules.js lib/booking/availability-v2.js tests/availability-v2.test.mjs
git commit -m "feat: calculate staff-aware availability"
```

### Task 4: Expose Safe Staff and Availability APIs

**Files:**
- Modify: `app/api/availability/route.js`
- Create: `app/api/staff/route.js`
- Create: `lib/booking/load-availability.js`
- Create: `lib/booking/errors.js`
- Create: `tests/availability-api-v2.test.mjs`

**Interfaces:**
- `GET /api/staff?serviceId=1` returns `{ staff: [{ id, displayName, bio, colourHex }] }`.
- `GET /api/availability?date=YYYY-MM-DD&serviceId=N&staffId=N|any` returns safe slot data.
- `toBookingHttpError(code)` returns `{ status, code, message }`.

- [ ] **Step 1: Write failing route-shape and error-map tests**

```js
test('availability supports staff preference without exposing private rows', async () => {
  const source = await readFile('app/api/availability/route.js', 'utf8')
  assert.match(source, /searchParams\.get\('staffId'\)/)
  assert.doesNotMatch(source, /reason/)
  assert.match(source, /buildStaffAvailability/)
})

test('slot conflicts map to a stable 409 response', () => {
  assert.deepEqual(toBookingHttpError('slot_unavailable'), {
    status: 409,
    code: 'slot_unavailable',
    message: '這個時段剛被預約，請選擇另一個時間。',
  })
})
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/availability-api-v2.test.mjs`

Expected: FAIL because the staff parameter, route, and error mapper are absent.

- [ ] **Step 3: Implement loader and routes**

Fetch service, public staff, staff-service links, weekly hours, time-off occupancy, appointments, business hours, blocked dates, and app settings in parallel. Pass only sanitized data to the response; server logs retain query errors.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
node --test tests/availability-api-v2.test.mjs tests/availability-v2.test.mjs
npm run test:unit
```

```powershell
git add app/api/availability app/api/staff lib/booking/load-availability.js lib/booking/errors.js tests/availability-api-v2.test.mjs
git commit -m "feat: expose staff-aware booking availability"
```

### Task 5: Add Atomic Booking, Reschedule, Cancel, and Package Commands

**Files:**
- Create via `supabase migration new booking_commands`: `supabase/migrations/*_booking_commands.sql`
- Create: `lib/booking/commands.js`
- Modify: `app/api/appointments/route.js`
- Modify: `app/api/account/bookings/[id]/route.js`
- Create: `tests/booking-commands.test.mjs`

**Interfaces:**
- RPC `create_appointment_v2(...)` returns the created appointment.
- RPC `reschedule_appointment_v2(p_appointment_id, p_starts_at, p_staff_preference)` returns the updated appointment.
- RPC `cancel_appointment_v2(p_appointment_id, p_actor_id)` returns the cancelled appointment.
- `createAppointment(db, input)`, `rescheduleAppointment(db, input)`, and `cancelAppointment(db, input)` map database codes to stable application errors. Create returns `{ appointment, confirmationToken }`; only the token hash is stored.

- [ ] **Step 1: Create an empty CLI migration and write failing tests**

```js
test('create command is atomic with package redemption', async () => {
  const sql = await readNewestMigration('booking_commands')
  assert.match(sql, /create or replace function public\.create_appointment_v2/i)
  assert.match(sql, /for update/i)
  assert.match(sql, /package_redemptions/i)
  assert.match(sql, /unique_violation|exclusion_violation/i)
})
```

Run: `node --test tests/booking-commands.test.mjs`

Expected: FAIL against the empty migration.

- [ ] **Step 2: Implement the SQL commands**

The server wrapper generates 32 cryptographically random bytes, sends only a SHA-256 hash into the RPC, and returns the raw token once to the browser. The create function must validate the service and customer ownership, rank eligible staff by active booking count then `sort_order` and `id`, lock the selected customer package row, insert the appointment with the token hash, decrement exactly once, and write `package_redemptions` in the same transaction. Catch exclusion violations per candidate and return `slot_unavailable` only when no eligible candidate remains.

Reschedule must secure the new slot before the old occupancy is released within the same transaction. Cancel must be idempotent and refund no more than one non-refunded redemption.

- [ ] **Step 3: Replace direct appointment writes with command wrappers**

```js
const { appointment, confirmationToken } = await createAppointment(db, {
  serviceId,
  staffPreference,
  startsAt,
  customer: authenticatedCustomer ?? guestContact,
  customerPackageId: authenticatedCustomer ? customerPackageId : null,
  source: authenticatedCustomer ? 'account' : 'web',
})

return NextResponse.json({ appointment, confirmationToken }, { status: 201 })
```

Return `409` for collision, `401` for protected package use, `403` for ownership failure, and `400` for invalid booking rules. Do not return raw PostgreSQL error messages.

- [ ] **Step 4: Verify RED/GREEN plus regression suite**

Run:

```powershell
node --test tests/booking-commands.test.mjs tests/package-usage.test.mjs tests/appointment-validation.test.mjs
npm run test:unit
```

Expected: all tests pass and neither route directly inserts into `appointments`.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations lib/booking/commands.js app/api/appointments/route.js app/api/account/bookings/[id]/route.js tests/booking-commands.test.mjs
git commit -m "feat: make booking and package changes atomic"
```

## Milestone 2 — Secure Customer Booking and Account Experience

### Task 6: Bind Customer Records to Authenticated Users

**Files:**
- Create via `supabase migration new customer_identity_binding`: `supabase/migrations/*_customer_identity_binding.sql`
- Create: `lib/customers/identity.js`
- Modify: `app/api/customers/route.js`
- Modify: `app/account/page.js`
- Create: `tests/customer-identity.test.mjs`

**Interfaces:**
- Produces nullable unique `customers.user_id` referencing `auth.users(id)`.
- `resolveAuthenticatedCustomer(serverClient, serviceClient)` returns the caller-owned customer or `null`.
- `GET /api/customers/me` returns only the signed-in customer's safe profile and usable packages.

- [ ] **Step 1: Write failing ownership and privacy tests**

```js
test('public customer API never supports phone-number lookup', async () => {
  const source = await readFile('app/api/customers/route.js', 'utf8')
  assert.doesNotMatch(source, /searchParams\.get\('phone'\)/)
  assert.match(source, /resolveAuthenticatedCustomer/)
})
```

Run: `node --test tests/customer-identity.test.mjs`

Expected: FAIL because the current endpoint searches by phone.

- [ ] **Step 2: Add the ownership migration and resolver**

Create ownership-based SELECT/UPDATE policies using `(select auth.uid()) = user_id`, with both `USING` and `WITH CHECK` for updates. Keep public guest creation server-only.

- [ ] **Step 3: Replace phone lookup with `/me` behavior**

Return `401 authentication_required` to unauthenticated callers and never include another customer's package rows.

- [ ] **Step 4: Verify and commit**

Run: `node --test tests/customer-identity.test.mjs tests/schema-security.test.mjs`

```powershell
git add supabase/migrations lib/customers/identity.js app/api/customers/route.js app/account/page.js tests/customer-identity.test.mjs
git commit -m "fix: secure customer and package ownership"
```

### Task 7: Replace the Long Booking Form with a Mobile-First Wizard

**Files:**
- Create: `app/booking/components/BookingWizard.jsx`
- Create: `app/booking/components/booking-reducer.js`
- Create: `app/booking/components/ServiceStep.jsx`
- Create: `app/booking/components/StaffStep.jsx`
- Create: `app/booking/components/TimeStep.jsx`
- Create: `app/booking/components/ContactStep.jsx`
- Create: `app/booking/components/ReviewStep.jsx`
- Modify: `app/booking/page.js`
- Remove after replacement: `app/booking/BookingForm.jsx`
- Modify: `app/globals.css`
- Create: `tests/booking-wizard.test.mjs`

**Interfaces:**
- Wizard state: `{ step, serviceId, staffPreference, date, startsAt, contact, customerPackageId, acceptedTerms }`.
- Actions: `SELECT_SERVICE`, `SELECT_STAFF`, `SELECT_SLOT`, `SET_CONTACT`, `SELECT_PACKAGE`, `BACK`, `NEXT`, `SUBMIT_START`, `SUBMIT_ERROR`.

- [ ] **Step 1: Write failing reducer and component-shape tests**

```js
test('changing service clears dependent staff and slot choices', () => {
  const next = bookingReducer(populatedState, { type: 'SELECT_SERVICE', serviceId: 7 })
  assert.equal(next.serviceId, 7)
  assert.equal(next.staffPreference, 'any')
  assert.equal(next.startsAt, '')
})
```

Run: `node --test tests/booking-wizard.test.mjs`

Expected: FAIL because the reducer and steps do not exist.

- [ ] **Step 2: Implement the reducer and five focused steps**

Each step receives serializable data and explicit callbacks. Use an `aria-current="step"` progress indicator, `aria-live="polite"` for availability messages, 44px minimum touch targets, and preserve completed choices when a `409` returns.

- [ ] **Step 3: Wire authenticated package loading and submission**

Only call `/api/customers/me` for an authenticated session. Guests see a clear sign-in option and self-pay path; they never trigger phone lookup.

- [ ] **Step 4: Run tests, perform React checklist, and commit**

Run:

```powershell
node --test tests/booking-wizard.test.mjs tests/booking-form.test.mjs
npm run test:unit
```

Remove or update obsolete BookingForm shape assertions only after the wizard tests are green.

```powershell
git add app/booking app/globals.css tests/booking-wizard.test.mjs tests/booking-form.test.mjs
git commit -m "feat: add secure mobile booking wizard"
```

### Task 8: Finish Confirmation and Account Self-Service

**Files:**
- Modify: `app/booking/confirm/page.js`
- Modify: `app/account/BookingsClient.jsx`
- Modify: `app/account/bookings/page.js`
- Modify: `app/api/appointments/[id]/ics/route.js`
- Modify: `app/api/account/bookings/[id]/route.js`
- Create: `tests/account-bookings-v2.test.mjs`

**Interfaces:**
- Confirmation pages require an authenticated owner or an unguessable confirmation token.
- Account booking payload includes safe service, staff, time, status, and package-redemption summary.

- [ ] **Step 1: Write failing access and behavior tests**

```js
test('confirmation does not expose bookings by numeric id alone', async () => {
  const source = await readFile('app/booking/confirm/page.js', 'utf8')
  assert.match(source, /confirmationToken|auth\.getUser/)
  assert.doesNotMatch(source, /serviceClient.*\.eq\('id',\s*id\)/s)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/account-bookings-v2.test.mjs`

Expected: FAIL against the current numeric-id flow.

- [ ] **Step 3: Implement secure confirmation, calendar, cancel, and reschedule flows**

The UI displays the assigned staff member. A reschedule keeps the old slot until the atomic command obtains the new slot. Cancellation explains whether a package session was refunded and blocks late cancellation using the configured cutoff.

- [ ] **Step 4: Verify and commit**

Run: `node --test tests/account-bookings-v2.test.mjs tests/availability-v2.test.mjs`

```powershell
git add app/booking/confirm app/account app/api/appointments/[id]/ics app/api/account/bookings/[id] tests/account-bookings-v2.test.mjs
git commit -m "feat: secure booking confirmation and self service"
```

## Milestone 3 — Operational Admin

### Task 9: Add Staff and Schedule Admin APIs

**Files:**
- Create: `app/api/admin/staff/route.js`
- Create: `app/api/admin/staff/[id]/route.js`
- Create: `app/api/admin/staff/[id]/hours/route.js`
- Create: `app/api/admin/staff/[id]/time-off/route.js`
- Create: `lib/validation/staff.js`
- Create: `tests/admin-staff.test.mjs`

**Interfaces:**
- Staff CRUD accepts display fields and `serviceIds`.
- Hours endpoint replaces all seven weekday rows atomically.
- Time-off endpoint creates and deletes ranges but rejects invalid or backwards ranges.

- [ ] **Step 1: Write failing validation and security tests**

```js
test('staff mutations require admin context, guards, validation and audit', async () => {
  const sources = await readAdminStaffRoutes()
  for (const source of sources) {
    assert.match(source, /adminContext\(/)
    assert.match(source, /guardMutationRequest\(/)
    assert.match(source, /audit\(/)
  }
})
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/admin-staff.test.mjs`

- [ ] **Step 3: Implement APIs with transaction-safe relationship replacement**

Validate names to 2–120 characters, color as six-digit hex, service ids as positive safe integers, weekdays 0–6, and `starts_at < ends_at`. Reject deactivation if the employee owns future appointments until admin reassigns or cancels them.

- [ ] **Step 4: Verify and commit**

Run: `node --test tests/admin-staff.test.mjs tests/admin-auth.test.mjs`

```powershell
git add app/api/admin/staff lib/validation/staff.js tests/admin-staff.test.mjs
git commit -m "feat: add staff and rota administration APIs"
```

### Task 10: Build the Admin Dashboard, Calendar, and Staff Workspace

**Files:**
- Create: `app/admin/components/AdminNav.jsx`
- Create: `app/admin/components/DashboardModule.jsx`
- Create: `app/admin/components/BookingCalendar.jsx`
- Create: `app/admin/components/StaffModule.jsx`
- Create: `app/admin/components/StaffHoursEditor.jsx`
- Create: `app/admin/components/TimeOffEditor.jsx`
- Modify: `app/admin/AdminShell.jsx`
- Modify: `app/api/admin/appointments/route.js`
- Modify: `app/globals.css`
- Create: `tests/admin-operations-v2.test.mjs`

**Interfaces:**
- Dashboard returns today's totals, pending count, expiring packages, and failed notifications.
- Calendar supports day/week ranges and filters by staff/status/service.
- Admin create and reschedule use the same booking commands as customer routes.

- [ ] **Step 1: Write failing module and route contract tests**

```js
test('admin calendar renders assigned staff and uses atomic booking commands', async () => {
  const calendar = await readFile('app/admin/components/BookingCalendar.jsx', 'utf8')
  const route = await readFile('app/api/admin/appointments/route.js', 'utf8')
  assert.match(calendar, /staff_name|staffName/)
  assert.match(route, /createAppointment|rescheduleAppointment/)
  assert.doesNotMatch(route, /\.from\('appointments'\)\.insert/)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/admin-operations-v2.test.mjs`

- [ ] **Step 3: Implement the focused modules and responsive navigation**

Use semantic buttons and tables/lists, visible loading and error states, Hong Kong date formatting, and consistent Traditional Chinese labels. Keep each module below roughly 300 lines by extracting editors and row components.

- [ ] **Step 4: Verify, apply React quality checklist, and commit**

Run: `node --test tests/admin-operations-v2.test.mjs tests/admin-modules.test.mjs`

```powershell
git add app/admin app/api/admin/appointments/route.js app/globals.css tests/admin-operations-v2.test.mjs
git commit -m "feat: add salon operations dashboard and calendar"
```

### Task 11: Finish Customer, Service, Package, Settings, and Audit Modules

**Files:**
- Split and replace: `app/components/admin/SalonAdminModules.jsx`
- Split and replace: `app/components/admin/SalonCustomerModules.jsx`
- Create: `app/admin/components/CustomersModule.jsx`
- Create: `app/admin/components/ServicesModule.jsx`
- Create: `app/admin/components/PackagesModule.jsx`
- Create: `app/admin/components/SettingsModule.jsx`
- Create: `app/admin/components/SiteContentModule.jsx`
- Create: `app/admin/components/AdministratorsModule.jsx`
- Create: `app/admin/components/AuditLogModule.jsx`
- Modify: relevant `app/api/admin/**/route.js` handlers
- Create: `tests/admin-modules-v2.test.mjs`

**Interfaces:**
- Service editor includes eligible staff mappings.
- Package editor includes eligible service mappings and HKD price.
- Customer view includes appointments, packages, redemptions, and audited manual adjustments.
- Settings include slot step, buffer, lead time, booking horizon, cancellation cutoff, and notification state.

- [ ] **Step 1: Write failing copy, currency, mapping, and audit tests**

```js
test('admin modules use Hong Kong copy and expose required mappings', async () => {
  const sources = await readNewAdminModules()
  const joined = sources.join('\n')
  assert.match(joined, /HK\$/)
  assert.doesNotMatch(joined, /£|Price in pence|Loading…/)
  assert.match(joined, /serviceIds/)
  assert.match(joined, /sessionsRemaining|sessions_remaining/)
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/admin-modules-v2.test.mjs`

- [ ] **Step 3: Implement and wire the split modules**

Every save button has disabled/loading/success/error states. Manual package balance changes require a reason and write before/after audit data. Stripe mock checkout is removed; without configured live/test Stripe keys, purchase controls are disabled with an honest message.

- [ ] **Step 4: Remove replaced modules, verify, and commit**

Run:

```powershell
node --test tests/admin-modules-v2.test.mjs tests/admin-modules.test.mjs tests/stripe.test.mjs
npm run test:unit
```

```powershell
git add app/admin/components app/components/admin app/api/admin tests/admin-modules-v2.test.mjs
git commit -m "feat: complete salon administration workspace"
```

## Milestone 4 — Production Quality and Release

### Task 12: Remove Placeholder Content and Finish Notifications

**Files:**
- Modify: `content/salon-poke-defaults.js`
- Modify: `app/layout.js`
- Modify: `app/page.js`
- Modify: `app/contact/page.js`
- Modify: `app/location/page.js`
- Modify: `lib/notifications/notify.js`
- Modify: `lib/notifications/email.js`
- Modify: `app/api/cron/reminders/route.js`
- Modify: `tests/no-placeholder-whatsapp.test.mjs`
- Create: `tests/production-content.test.mjs`

**Interfaces:**
- Missing contact fields are hidden rather than replaced with fake values.
- Notification records distinguish `sent`, `failed`, `disabled`, and `dry_run`.
- Reminder job is idempotent per appointment, event, and configured reminder window.

- [ ] **Step 1: Write failing production-content and notification-state tests**

```js
test('public content contains no launch placeholders', async () => {
  const source = await readPublicSources()
  assert.doesNotMatch(source, /XXXXXXXX|待提供|示意圖|example\.com/i)
})
```

- [ ] **Step 2: Verify RED against current placeholders**

Run: `node --test tests/production-content.test.mjs tests/no-placeholder-whatsapp.test.mjs`

Expected: FAIL because the current deployed fallback includes placeholder WhatsApp and telephone values.

- [ ] **Step 3: Hide missing content and make notification status truthful**

Do not invent the salon's phone, address, email, or social accounts. Render those controls only when saved content passes validation. Record provider response ids on successful email delivery and actionable error messages on failure.

- [ ] **Step 4: Verify and commit**

Run: `node --test tests/production-content.test.mjs tests/notifications.test.mjs tests/email-notify.test.mjs`

```powershell
git add content app/layout.js app/page.js app/contact app/location lib/notifications app/api/cron tests
git commit -m "fix: remove placeholders and harden notifications"
```

### Task 13: Add End-to-End Acceptance Coverage

**Files:**
- Create: `playwright.config.js`
- Create: `e2e/booking.spec.js`
- Create: `e2e/account.spec.js`
- Create: `e2e/admin.spec.js`
- Create: `scripts/seed-e2e.mjs`
- Modify: `.gitignore`

**Interfaces:**
- E2E seed creates deterministic service, two employees, weekly schedules, one customer, and one usable package in a non-production database.
- Tests consume `E2E_BASE_URL` and dedicated Supabase test credentials.

- [ ] **Step 1: Write failing browser tests**

```js
test('guest books with any available staff and sees an assigned employee', async ({ page }) => {
  await page.goto('/booking')
  await page.getByRole('radio', { name: '創意剪髮' }).check()
  await page.getByRole('radio', { name: '任何可服務員工' }).check()
  await chooseFirstAvailableSlot(page)
  await completeGuestContact(page)
  await page.getByRole('button', { name: '確認預約' }).click()
  await expect(page.getByText(/預約編號/)).toBeVisible()
  await expect(page.getByText(/服務員工/)).toBeVisible()
})
```

- [ ] **Step 2: Run E2E and verify RED**

Run: `npm run test:e2e -- --project=chromium`

Expected: FAIL until stable test data and final UI selectors are wired.

- [ ] **Step 3: Add isolated seed and complete three critical journeys**

Cover guest self-pay booking, authenticated package booking plus cancellation refund, and admin staff schedule change affecting public availability. Add a concurrent API test that submits two overlapping bookings and expects one `201` and one `409`.

- [ ] **Step 4: Verify and commit**

Run: `npm run test:e2e -- --project=chromium`

Expected: all critical journeys pass against the isolated test environment.

```powershell
git add playwright.config.js e2e scripts/seed-e2e.mjs .gitignore
git commit -m "test: cover booking platform end to end"
```

### Task 14: Full Verification, Migration Rehearsal, and Vercel Release

**Files:**
- Modify: `README.md`
- Modify: `docs/launch-checklist-2026-09-07.md`
- Create: `docs/launch-checklist-2026-09-14.md`
- Create: `docs/booking-platform-operations.md`

**Interfaces:**
- Runbook documents setup, migration preflight, rollback, first-admin creation, staff onboarding, environment variables, and daily booking operations.

- [ ] **Step 1: Run the complete local verification gate**

Run:

```powershell
npm run test:unit
npm run test:e2e -- --project=chromium
npm run security:scan
npm run build
git diff --check
```

Expected: every command exits 0 with no test failures or build errors.

- [ ] **Step 2: Rehearse migrations on a disposable Supabase branch/project**

Apply migrations in filename order, run the overlap preflight, verify RLS with two customer users and one non-admin user, then run database advisors. Confirm one accepted and one rejected booking under a deliberate concurrency race.

- [ ] **Step 3: Write the verified runbook and rollback procedure**

Record exact required environment variable names, which content fields remain intentionally hidden, migration verification queries, backup confirmation, deployment URL, and how to disable new bookings without losing existing appointments.

- [ ] **Step 4: Deploy a Vercel preview and repeat the smoke gate**

Verify `/`, `/services`, `/booking`, `/signin`, `/account`, `/admin/login`, authenticated `/admin`, availability, create, reschedule, cancel, cron authorization, and notification status. Capture HTTP statuses and booking references in the launch checklist without storing personal data or secrets.

- [ ] **Step 5: Release production only after the checklist is green**

Apply the production migration, configure the first real staff schedules and service mappings, deploy the verified commit, and repeat the guest, member-package, admin, and collision smoke tests. If any P0 security/data-loss or P1 booking-integrity check fails, disable new booking submission and roll back the application deployment while retaining additive schema changes.

- [ ] **Step 6: Final verification and commit documentation**

Run the full verification gate again after documentation changes.

```powershell
git add README.md docs
git commit -m "docs: add booking platform operations and launch runbook"
```

## Final Requirements Audit

- [ ] Staff skill mapping, weekly hours, breaks/time off, and active state are operational.
- [ ] Specified-staff and any-staff booking return correct availability.
- [ ] PostgreSQL rejects overlapping occupancy under concurrency.
- [ ] Create/reschedule/cancel and package redemption/refund are atomic and idempotent.
- [ ] Anonymous phone lookup no longer exposes customer or package data.
- [ ] Customer confirmation, account, calendar download, cancellation, and rescheduling enforce ownership.
- [ ] Admin dashboard, calendar, customers, staff, services, packages, settings, content, administrators, and audit log are usable on mobile and desktop.
- [ ] Missing business contact data is hidden and no launch placeholders remain.
- [ ] Unit, database integration, API, E2E, security scan, and production build gates pass.
- [ ] Supabase migration and Vercel production smoke evidence are recorded.
