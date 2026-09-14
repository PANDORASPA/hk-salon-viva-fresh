# Supabase setup and staff foundation rollout

The canonical SQL is in `supabase/migrations`. The previous March 2026 setup list
described the retired `bookings` platform; this application uses `appointments`.
Do not apply root-level legacy SQL as a substitute for the migrations below.

## Canonical migration order

Apply **every** checked-in SQL file, not a copied partial list. Generate the authoritative inventory from the release checkout:

```powershell
git rev-parse HEAD
Get-ChildItem -LiteralPath supabase/migrations -Filter '*.sql' | Sort-Object Name | Select-Object -ExpandProperty Name
```

The current inventory contains 29 files and ends at `20260915050000_final_release_integrity.sql`. The final additive repair denies browser appointment writes/private reads, grants the server's required operations, normalizes legacy buffers to 0–120/default 15, and adds the remaining audited admin commands. Its CLI-generated timestamp was advanced beyond the previously future-dated inventory so it is applied last. No already-applied migration is changed in this final wave.

Record the generated list and candidate commit in release evidence. Supabase CLI migration history remains authoritative for what has already applied; never rerun selected SQL statements as a substitute for a full migration.

Fresh-install replay now creates `package_redemptions` before its composite type
is referenced, and explicitly drops/recreates the legacy
`deduct_package_session(bigint,bigint)` signature when changing its return type
from `void`. The DROP does not use CASCADE, and its service-role grant is restored
in the same migration. No table or data is dropped. Supabase does not rerun an
already-applied migration, so these historical-file corrections affect fresh
replay only. The new command migration separately upgrades refund behavior on
both existing and new databases. Staff-schema tests and booking-command tests
now replay every predecessor, without skipping the historical RPC migration.

## Staff foundation: before applying

Use a backup and first rehearse against an isolated copy of the existing database.
Apply the entire migration file during a quiet period: its transaction takes an
exclusive lock on appointments until completion. Public display and server
booking readers/writers may wait while the lock is held.

The preflight runs before creating staff or changing appointment rows. Every
legacy appointment is assigned to the default staff member and receives a saved
15-minute buffer, matching the historical public booking RPC. Cancelled and
no-show appointments retain their data but do not occupy time. Pending, confirmed
and completed appointments all participate in overlap checks, including history.
No conflicts are automatically cancelled, deleted, moved or reassigned.

Run these read-only checks before migration; both must return no problem rows:

```sql
select id, reference, starts_at, ends_at
from public.appointments
where not isfinite(starts_at) or not isfinite(ends_at) or ends_at <= starts_at;

select a.id as first_id, a.reference as first_reference,
       b.id as second_id, b.reference as second_reference,
       a.starts_at as first_start, a.ends_at + interval '15 minutes' as first_occupied_until,
       b.starts_at as second_start, b.ends_at + interval '15 minutes' as second_occupied_until
from public.appointments a
join public.appointments b on a.id < b.id
where a.status in ('pending','confirmed','completed')
  and b.status in ('pending','confirmed','completed')
  and a.starts_at < b.ends_at + interval '15 minutes'
  and b.starts_at < a.ends_at + interval '15 minutes'
order by a.id, b.id;
```

A failed preflight reports the number of conflicting pairs and leaves the entire
transaction unapplied. If using an interactive SQL session, issue `ROLLBACK`
after an error. Resolve the identified records with the shop owner, then retry the
whole file. Do not apply selected statements or disable the exclusion constraint.
After a successful application, let Supabase migration history prevent replay;
this migration is transactional, not an independently repeatable SQL script.

## Resulting interfaces and access

- `staff`: `name` is internal; public queries explicitly select
  `id,display_name,bio,colour_hex,is_active,sort_order`. Only active rows are visible.
  `select('*')` deliberately fails for public/member clients because it includes
  private columns. Server admin routes use the service role to read full records.
- `staff_services`: composite key `(staff_id,service_id)`; public reads require
  active staff plus an enabled, published service. The initial default staff is
  assigned all enabled services, including unpublished ones for later publishing.
- `staff_weekly_hours`: composite key `(staff_id,weekday)`; `weekday` is 0–6,
  `is_working` and local `starts_at`/`ends_at` are seeded from `business_hours`.
  Weekly hours for active staff are available to public availability consumers.
- `staff_time_off`: exact timestamp ranges, optional private `reason` and
  `created_by`. Anonymous clients have no access. Authenticated non-admin reads
  return zero rows; active admins may read, and server routes may manage records.
- All four tables use RLS and explicit grants. All direct browser mutations are
  denied; admin writes belong in server routes that recheck `admin_users`, validate
  input and audit the change. The service role receives only required CRUD and
  identity-sequence usage privileges. Old automatic grants are explicitly revoked.
- `appointments.staff_id` and `occupied_until` are required. A temporary default
  staff ID preserves old insert/RPC calls until the new commands assign staff
  explicitly. Explicit null staff is rejected. Retire this compatibility default
  after all booking commands have migrated; it is not an availability allocator.
- `buffer_minutes` defaults to 15 and is restricted to 0–120. An invoker trigger
  derives `occupied_until = ends_at + buffer_minutes` on every insert/update;
  supplied range ends cannot shrink occupancy. `[starts_at,occupied_until)` allows
  the next booking at the exact range boundary. Cancelled/no-show states release
  occupancy; restoring an active state must pass the constraint again.
- `source` is `web`, `account` or `admin`; confirmation stores only
  `confirmation_token_hash`. Cancellation metadata is `cancelled_at` plus nullable
  auth-user FK `cancelled_by`. The server generates 32 random token bytes, stores
  only a SHA-256 hash, and returns the raw token once after successful creation.

The atomic v2 RPCs revalidate active staff, skills, shop/staff hours, time off,
blocked dates, slot grid, lead time, booking horizon and package entitlement.
The server-only invoker functions have explicit service-role grants and revoke
PUBLIC/anon/authenticated execution. Each staff collision attempt has its own
exception block; the exclusion constraint is authoritative. Reschedule updates
the existing row in one transaction, preserving its original redemption, and
cancel marks that redemption refunded once while retaining the audit record.

`createAppointmentsHandler` accepts a trusted `resolveCustomer(request)` returning
`{ customer, actorUserId }`. The verified resolver and `customers.user_id` binding are implemented.
Guests may self-pay but cannot use member entitlements; SQL fails closed
when the verified identity binding is absent. Request-body
customer IDs, actor IDs and source values are never identity proof. Reschedule
passes the verified actor as the fourth RPC argument (defaulting to `auth.uid()`
for SQL clients); cancellation passes the verified actor as its second argument.
Cancellation cutoff is enforced from the transactional `app_settings` value;
the old route-only environment override is no longer authoritative.

## After applying

Record appointment counts before/after and verify all historical references are
still present. The migration updates appointment `updated_at` via the existing
update trigger; business fields, IDs and created timestamps are preserved.

```sql
select count(*) as appointments,
       count(*) filter (where staff_id is null or occupied_until is null) as missing_staff_or_end,
       count(*) filter (where occupied_until <> ends_at + make_interval(mins => buffer_minutes)) as invalid_occupancy
from public.appointments;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.appointments'::regclass
  and conname = 'appointments_staff_occupied_excl';

select c.relname, c.relrowsecurity
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('staff','staff_services','staff_weekly_hours','staff_time_off');

select * from public.staff_services order by staff_id, service_id;
select * from public.staff_weekly_hours order by staff_id, weekday;
```

Expect zero missing/invalid occupancy rows, one exclusion constraint, and RLS true
for all four tables. Verify staff display and private time-off reads using actual
anon, member and admin sessions before deployment.

Run `node --test tests/booking-staff-schema.test.mjs tests/booking-commands.test.mjs tests/customer-identity.test.mjs tests/final-integration.test.mjs` for the disposable PostgreSQL
tests, then `npm run test:unit`. The tests use pinned PGlite PostgreSQL WASM with
real `btree_gist`/`pgcrypto` extensions and execute this migration unmodified.
They cover backfill, transactional preflight failure, exclusion behavior, range
derivation, legacy insert compatibility and role-based SQL access, both with and
without old automatic grants. Supabase-owned auth/storage fixture scaffolding is
minimal. `node --test tests/booking-commands.test.mjs` adds full-chain replay,
real route-to-RPC execution, package rollback, collision retry and refund tests.
Its package cases bind disposable owned customer fixtures;
the guest/full-chain case verifies fail-closed behavior without an owner binding.
This is not a PostgREST, hosted Supabase, advisor or concurrent-session test. A
full local/preview Supabase verification remains part of the release gate.

The migration follows the [2026 Data API explicit-grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
and [Supabase API security guidance](https://supabase.com/docs/guides/api/securing-your-api).
