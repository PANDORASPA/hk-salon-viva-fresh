# Task 5 — Atomic booking commands

Status: implemented and verified; no hosted database or deployment was changed.

## Delivered interfaces

- `create_appointment_v2`: validates enabled/published service, current booking
  window, Hong Kong shop/staff hours, blocked dates, staff skills/activity, slot
  grid, time off and package entitlement in one transaction. Any-staff candidates
  rank by that HK day's active booking count, then `sort_order`, then `id`.
  Every candidate insert has its own PL/pgSQL exception subtransaction, so an
  exclusion violation tries the next eligible staff. Exhaustion returns B0002.
- `reschedule_appointment_v2(appointment_id, starts_at, staff_preference,
  actor_id default auth.uid())`: locks the existing appointment, checks the
  verified actor and package's applicability/expiry, then updates the same row
  under the exclusion constraint. The server wrapper explicitly passes actor ID
  as the fourth argument. A failed candidate restores the prior row; success
  retains ID/reference/redemption. There is no refund/re-debit or collision gap.
- `cancel_appointment_v2(appointment_id, actor_id)`: locks the appointment,
  authorizes the owner or active admin, checks the transactional cancellation
  cutoff and status, refunds at most one unrefunded redemption, and marks the
  appointment cancelled in the same transaction. A repeat returns the same row.
- `refund_customer_package`: upgraded in the new migration to mark refunded_at
  instead of deleting the ledger row. A stale legacy refund after a new package
  use cannot credit the cancelled appointment again.
- `createAppointment`, `rescheduleAppointment`, `cancelAppointment` execute only
  the RPCs, with no direct-write/legacy fallback. Database errors map via custom
  SQLSTATE codes to stable 400/401/403/404/409/500 application errors; arbitrary
  PostgreSQL message/detail/hint/context never reaches the response. The cutoff
  response preserves only two validated numeric fields for the existing UI.
- Create generates 32 random bytes using Node crypto, returns base64url raw
  confirmationToken once, sends only its SHA-256 hex digest to SQL, and removes
  hashes/admin notes from all returned appointment projections.
- Both mutation routes now call these wrappers. Injectable route factories and
  existing dependency setters are retained. Account params are awaited for the
  current Next.js API. Account GET also rejects null/mismatched user ownership.
- Reschedule notification text now correctly says the original package use is
  retained, and omits the previous-time clause when that value is unavailable.

## Identity boundary and next task

The approved mapping field is `customers.user_id`. SQL reads it through
`to_jsonb(customer_row)->>'user_id'`, so this migration compiles before Task 6 and
ownership fails closed when the key or binding is absent. Only service_role can
execute the invoker commands; explicit table/sequence privileges are supplied.
SELECT FOR SHARE has the minimum UPDATE-column grants PostgreSQL requires.

The create-route dependency `resolveCustomer(request)` returns
`{ customer, actorUserId }` from verified server auth. Its default is null until
Task 6 supplies that resolver. Guests can book; a package request returns 401
until the trusted identity path is wired. Browser customerId/actorUserId/source
are ignored. Package ownership is rechecked in SQL, including customer binding,
package customer, active catalogue/service mapping, expiry at the appointment
start, and locked remaining balance. An active admin actor is supported for the
planned admin command routes.

## Historical migration repair

Applied the controller's narrowly scoped correction to
`20260907000000_package_redeem_rpc.sql`:

1. Moved the existing CREATE TABLE for package_redemptions before the first
   function signature that returns that composite type.
2. Added explicit `DROP FUNCTION IF EXISTS deduct_package_session(bigint,bigint)`
   before recreating its changed return type. No CASCADE is used, so unknown
   dependents fail safely. Existing statements restore service-role execution.

No data/table is dropped. Supabase does not replay an already-applied migration,
so this historical correction affects only fresh replay. Existing databases get
the new refund behavior through the new command migration. The setup guide now
documents the repaired chain; Task 2 tests no longer skip that predecessor.

## Skills and current documentation

Used Supabase, test-driven-development, systematic-debugging and
verification-before-completion skills. Read the local Next.js route guide.
Fetched/scanned the Supabase changelog (PowerShell fallback because web cannot
parse its Markdown content type) and followed the relevant explicit-grant and
Node-version changes. Runtime is Node v22.14.0.

- https://supabase.com/changelog.md
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- https://supabase.com/changelog/45715-deprecation-notice-dropping-support-for-node-js-20
- https://supabase.com/docs/guides/database/functions
- https://www.postgresql.org/docs/current/plpgsql-control-structures.html
- https://www.postgresql.org/docs/current/ddl-constraints.html

Created the new file using the CLI, after reading help:

```text
npx supabase migration new --help
npx supabase migration new booking_commands
Migration created: supabase/migrations/20260914110338_booking_commands.sql
```

## RED evidence

```text
node --test tests/booking-commands.test.mjs
8 tests, 0 pass, 8 fail; exit 1; duration_ms 25992.5074
```

The actual unmodified migration chain failed with 42704:
`type public.package_redemptions does not exist`. After the historical fixes,
the full-chain case reached the intended missing-command RED (42883), proving
both historical compile defects were cleared before command implementation.
The final suite also executes a controlled mutation that omits only the new
DROP: PostgreSQL reproduces 42P13 `cannot change return type of existing function`.

```text
node --test --test-name-pattern='route' tests/booking-commands.test.mjs
2 tests, 0 pass, 2 fail; missing route factories; exit 1

node --test --test-name-pattern='cancel refunds|only service_role' tests/booking-commands.test.mjs
2 tests, 0 pass, 2 fail; exit 1
```

The latter RED exposed stale legacy refund crediting 2 instead of 1, and the
invoker row lock lacking UPDATE privilege on services. Each root cause was fixed
independently and each focused regression then passed.

Additional RED/GREEN cases caught impossible dates normalizing into another day,
missing numeric cancellation-cutoff response fields, and obsolete reschedule
notification text claiming another debit. The preserved Task 1 test also showed
500 instead of 201 because its transport double supported direct inserts only.
Its fake now exposes/asserts create_appointment_v2 and keeps the two canonical
appointment read boundaries. No production test-only fallback was introduced.

## Verification

```text
node --test tests/booking-commands.test.mjs tests/package-usage.test.mjs tests/appointment-validation.test.mjs
23 passed, 0 failed; exit 0; duration_ms 48419.7557

node --test --test-name-pattern='impossible|account routes' tests/booking-commands.test.mjs
2 passed, 0 failed; exit 0; duration_ms 5185.5467

node --test tests/notifications.test.mjs
7 passed, 0 failed; exit 0; duration_ms 408.9283

npm run test:unit
177 passed, 0 failed, 0 skipped; exit 0; duration_ms 57298.996

npm run build
exit 0; Next.js 16.3.4 compiled, type checked, generated all pages and registered both command routes

git diff --check
exit 0
```

PGlite starts/closes a disposable real PostgreSQL engine for every SQL case,
loads pgcrypto/btree_gist, and executes every actual application migration in
filename order. Only Supabase-owned auth/storage infrastructure is stubbed.
Package cases clearly add a forward-compatible Task 6 customers.user_id fixture;
the full-chain guest case runs without it and proves package access fails closed.
The transport adapter sends the real production route/wrapper RPC calls into
those real SQL functions. No schema/command behavior is replaced by mock SQL.

Observed behavior includes collision retry and final exhaustion, deterministic
workload/sort/id ranking, all booking rule classes, package ownership/service/
expiry/balance rejection, redemption failure rolling back appointment+balance,
reschedule collision restoring the complete old row, successful move retaining
the redemption, cancellation status failure rolling back its refund, repeated
refund staying once-only, role denial and real service-role command execution,
token hash verification, response sanitization and public/account route status
mapping. Promise fan-out verifies last-session consumption leaves exactly one
appointment/redemption and zero remaining sessions.

## Self-review and concerns

- Confirmed custom functions are SECURITY INVOKER with fixed empty search_path,
  schema-qualified relations, and explicit PUBLIC/anon/authenticated EXECUTE
  revokes. Legacy refund/deduct/redeem browser grants are also revoked.
- Only appointments stores bookings. The two scoped routes have no direct
  appointment insert/update or application-side package compensation.
- Package locks serialize balance mutation, appointment locks serialize changes,
  and the existing GiST exclusion constraint arbitrates occupancy. Failed
  candidate INSERT/UPDATE operations roll back in their own exception blocks.
- Cancellation cutoff now comes from app_settings inside the transaction. The
  old route-only CANCEL_CUTOFF_HOURS environment override is no longer used.
- Cancellation returns the appointment. The old inferred packageRefunded flag
  is omitted rather than asserting a refund for legacy rows without redemption
  history; Task 8 can surface the retained ledger's refund information.
- PGlite has one backend: Promise fan-out is not a true multi-session concurrency
  timing/stress test. No PostgREST/hosted Supabase/advisor proof is claimed.
  `npx supabase db advisors --help` succeeded; `npx supabase db advisors --local`
  failed with ECONNREFUSED 127.0.0.1:54322. Docker/Podman is unavailable as already
  established in Task 2. A local/preview Supabase multi-session release check
  remains necessary; no production database was accessed or changed.
- Existing MODULE_TYPELESS_PACKAGE_JSON warnings and optional resend/stripe plus
  custom static Cache-Control build warnings remain unchanged and non-fatal.

Commit: recorded in the completion message after staging all Task 5 files.
