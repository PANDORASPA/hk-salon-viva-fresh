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

## Fix Round 1 — legacy RPC permissions and original local-date validation

Both reviewer findings were reproduced before changing production code.

### Root causes and fixes

The historical `create_salon_appointment_with_package(uuid,bigint,bigint,bigint,
text,text,text,timestamptz,text)` is SECURITY DEFINER and had no execution revoke.
Restricting its inner deduction function did not restrict the wrapper, which
calls it with the wrapper owner's privileges. The old
`create_salon_appointment(bigint,uuid,text,text,text,timestamptz,text)` revoked
PUBLIC only; explicit grants inherited from older default privileges remained.

Audited the full migration chain's five legacy booking mutation signatures:
create_salon_appointment, create_salon_appointment_with_package,
deduct_package_session, redeem_customer_package and refund_customer_package.
The new command migration now explicitly revokes all five from PUBLIC, anon and
authenticated, including both creation wrappers. It explicitly grants their
known signatures to service_role for trusted legacy server compatibility. The
current routes continue to use only the validated v2 commands. No function or
customer data is dropped, and no global default grants for unrelated APIs change.

The account PATCH `{date,time}` branch used hkLocalToIso, whose Date.UTC call
normalizes invalid calendar/clock components. Strict validation afterward saw
the normalized valid date rather than the original user value. That branch now
checks exact string formats, 00–23 hours and 00–59 minutes, and confirms the
calendar date round-trips unchanged before constructing the explicit HK-offset
timestamp. It no longer calls the permissive converter. The original `startsAt`
branch retains the command wrapper's strict validation.

### RED/GREEN evidence

```text
node --test --test-name-pattern='every booking mutation|original date and time' tests/booking-commands.test.mjs
3 tests, 0 pass, 3 fail; exit 1; duration_ms 11728.9403
```

RED failures were:

- Missing rejection: anon executed create_salon_appointment_with_package with
  a forged user/admin note, another customer's package and an inapplicable
  service.
- With older default EXECUTE grants enabled, anon also executed
  create_salon_appointment.
- The real account PATCH route accepted September 31 and returned 200 instead
  of 400, changing the appointment to the normalized October date.

```text
node --test --test-name-pattern='every booking mutation' tests/booking-commands.test.mjs
2 passed, 0 failed; exit 0; duration_ms 7942.2067

node --test --test-name-pattern='original date and time' tests/booking-commands.test.mjs
1 passed, 0 failed; exit 0; duration_ms 5133.8815
```

The permission tests enumerate eight installed mutation signatures from the
PostgreSQL catalog (five legacy plus three v2), then actually execute each under
SET ROLE anon and SET ROLE authenticated and require SQLSTATE 42501. This runs
with normal privileges and with explicit older default EXECUTE grants. They
also verify unchanged appointment/redemption counts and package balance after
browser attempts, all eight service-role execution grants, and actual legacy
server create/package/deduct/redeem/refund behavior. Existing tests continue to
execute create/reschedule/cancel as service_role.

The new route test exercises 16 invalid date/time shapes, including September
31, a non-leap February 29, month 13, 24:00/24:30, overflowing minutes, unpadded
hours, padded values, seconds/suffixes and array inputs. Each returns stable
400 validation_error and preserves the entire original appointment, balance and
unrefunded ledger. A valid `{date,time}` control then reschedules successfully
through the same production route, command wrapper and real SQL.

### Changed files

- `supabase/migrations/20260914110338_booking_commands.sql`
- `app/api/account/bookings/[id]/route.js`
- `tests/booking-commands.test.mjs`
- `tests/helpers/booking-database.mjs`
- This report.

### Final verification

```text
node --test tests/booking-commands.test.mjs tests/package-usage.test.mjs tests/appointment-validation.test.mjs
26 passed, 0 failed, 0 skipped; exit 0; duration_ms 75941.4001

npm run test:unit
180 passed, 0 failed, 0 skipped; exit 0; duration_ms 74624.7615

npm run build
exit 0; Next.js 16.3.4 compiled in 13.7s, completed type checking and generated all pages

git diff --check
exit 0

npx supabase db advisors --local
exit 1; existing local-server limitation: ECONNREFUSED 127.0.0.1:54322
```

Self-review confirms that the canonical migration inventory contains five
legacy and three v2 booking mutation signatures, every one is exercised by the
role tests, and both browser roles lose inherited as well as PUBLIC access.
The strict local date/time path preserves valid HK inputs and rejects invalid
ones before any normalization or database mutation. The existing module-type
and optional resend/stripe/static Cache-Control build warnings remain non-fatal.
No hosted database or deployment was changed; the previous PGlite single-backend
and advisor limitations are unchanged. Both Fix Round 1 findings are addressed.
