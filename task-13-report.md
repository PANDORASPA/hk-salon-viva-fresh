# Task 13 — E2E acceptance coverage

## Delivered

- Playwright Chromium configuration, serialised because all journeys share one
  deterministic isolated database namespace.
- Browser/API acceptance journeys for guest self-pay booking with assigned
  staff, authenticated package redemption and cancellation refund, admin staff
  hours removing public availability, and two concurrent overlapping booking
  requests that must yield exactly one `201` and one `409`.
- `scripts/seed-e2e.mjs` seeds one service, two staff members with full weekly
  schedules, an authenticated customer with a usable two-session package, and
  an authenticated administrator. `cleanup` removes namespaced application
  data and test identities.
- Seed safety is regression-tested. It requires explicit E2E credentials, a
  strong E2E password, localhost or explicitly named `e2e`/`test` URLs, and an
  exact pre-existing `app_settings.data.e2e_marker`. It rejects production and
  preview-looking targets before opening a connection. A non-test bootstrap
  admin is required because the database correctly prevents removal of the
  last active administrator.

## Verification

- `node --test tests/e2e-seed-safety.test.mjs tests/e2e-seed-entrypoint.test.mjs`
  — passed (3 tests).
- `npm run test:unit` — passed (274 tests).
- `npm run build` — completed successfully. Existing optional dynamic imports
  of `resend` and `stripe`, plus a custom Cache-Control warning, remain build
  warnings and were not changed by this task.
- `npm run test:e2e -- --project=chromium` — deliberately fails before any
  navigation or mutation: this workspace has no `E2E_BASE_URL`,
  `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_ROLE_KEY`,
  `E2E_DATABASE_MARKER`, or `E2E_TEST_PASSWORD`.
- `npm run seed:e2e` — deliberately refuses at the same safe preflight. No
  Supabase environment or production/preview system was touched.

## Remaining external setup

Provision a migrated, isolated Supabase database, give its `app_settings` row
the exact marker value, retain one non-test active bootstrap administrator, and
start the app with the matching isolated `NEXT_PUBLIC_SUPABASE_*` and service
credentials. The exact local setup and run order are in `e2e/README.md`.

## Fix round 1

- Added one mandatory preflight for seed and Playwright global setup: canonical
  host validation, marked-database query, and a marker-bound /api/e2e probe.
- .env.e2e.local is explicitly loaded without echoing values. Cleanup uses
  exact identity/fixture IDs and names, removes fixture notifications first,
  and restores business hours/settings from a local runtime snapshot.
- Browser journeys use independent dates; guest staff and package records now
  have exact assertions.

## Fix round 2

- The probe is explicitly enabled only for E2E and hard-denies production and
  preview runtime signals. Runtime snapshots bind database origin, marker,
  namespace, and a unique run id before any state mutation.
- Fixture customer cleanup now keys off exact E2E auth-user IDs regardless of
  profile name, and restores the original business-hour row set exactly.

## Fix round 2 follow-up

- Global setup becomes cleanup-ready immediately after its read-only runtime
  preflight. If seeding fails partway through, it invokes the same guarded
  cleanup and reports both errors when cleanup also fails. Seed mutation work
  uses the same failure-unwind path, while cleanup restores business settings
  even when a prior fixture delete failed.
- The snapshot must match the canonical Supabase origin, marker, namespace,
  and non-empty run id. A mismatched stale local snapshot is removed and the
  run is refused before a database mutation. Restoration clears all business
  hour rows before upserting the original rows, so originally absent weekdays
  remain absent; it cannot restore settings across database bindings.
- Fixture audit records are deleted only by exact fixture actor-user IDs.
  Customer cleanup remains anchored to exact fixture auth IDs before those
  identities are deleted.
- The schedule journey preserves and restores the selected weekday's exact
  prior working flag and time values in a browser-test `finally` block. Its
  public assertion uses its own date, so the guest and concurrency dates are
  independent. The package-refund journey uses the generated confirmation
  reference as the account article's accessible name and asserts the exact
  seeded package balance before and after cancellation, not a mutable status
  phrase.

## Follow-up verification

- Focused E2E-safety tests: 13 passed, 0 failed.
- Full unit suite: 284 passed, 0 failed.
- `npm run build`: succeeded. Existing optional `resend`/`stripe` dynamic
  import and custom Cache-Control warnings remain unchanged.
- `npx playwright test --list`: 4 browser journeys discovered. The no-credential
  browser run deliberately stopped in global preflight with
  `E2E_TEST_PASSWORD is required`, before navigation or a database mutation.
