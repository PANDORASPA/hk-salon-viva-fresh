# Booking platform operations

This runbook applies to the current staff-aware booking platform. It is intentionally procedural: no command in this document authorises an unreviewed production migration or deployment. All times and booking decisions use `Asia/Hong_Kong`.

## Before any release

1. Confirm a release owner, an authorised migration operator, a rollback owner, and the launch window.
2. Confirm the target origin, its separate Supabase project, and a fresh recoverable database backup. Record only the backup job/timestamp, never credentials.
3. Run the local gate: `npm run test:unit`, `npm run security:scan`, `npm run build`, and `git diff --check`.
4. Run the browser suite only after provisioning the isolated E2E environment described below. A credential preflight refusal prevents mutations but is still a release blocker.
5. Complete the current [launch checklist](launch-checklist-2026-09-14.md). Preview and production require their own evidence.

## Environment and hosted setup

Configure the names below in the target secret store, never in source control.

| Area | Names |
| --- | --- |
| Public Supabase client | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Server database client | `SUPABASE_SERVICE_ROLE_KEY` |
| Canonical site origin | `NEXT_PUBLIC_SITE_URL` |
| Reminder cron | `CRON_SECRET` |
| Email | `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `NOTIFY_EMAIL_PROVIDER`, `NOTIFY_DRY_RUN` |
| WhatsApp setting | `NOTIFY_WHATSAPP_PROVIDER` |
| Stripe, only when enabled | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_CURRENCY` |
| Optional shared rate-limit store | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

Add `/auth/callback` under the exact `NEXT_PUBLIC_SITE_URL` to Supabase Auth redirect configuration. The cron route is `/api/cron/reminders`; use an `Authorization: Bearer` header derived from `CRON_SECRET`. The legacy query-secret compatibility path must not be used for new schedules.

## Migration rehearsal and production preflight

The local PGlite suite replays every checked-in application migration unmodified and checks real command behavior. It is a **local rehearsal**, not proof of hosted Supabase extensions, advisors, Auth, Storage, Data API, network behavior, or real multi-connection PostgreSQL scheduling.

For a hosted clone/isolated project, first list and apply all migration files in ascending filename order. Do not edit a migration that may already be applied; create an additive, forward-only repair migration instead. Before opening bookings, run this read-only overlap query and require zero rows:

```sql
with active as (
  select id, staff_id, starts_at, occupied_until
  from public.appointments
  where status in ('pending', 'confirmed', 'completed')
), ordered as (
  select *, lag(occupied_until) over (partition by staff_id order by starts_at, id) as prior_occupied_until
  from active
)
select id, staff_id, starts_at, occupied_until, prior_occupied_until
from ordered
where starts_at < prior_occupied_until
order by staff_id, starts_at, id;
```

Then confirm the constraint and RLS state:

```sql
select conname
from pg_constraint
where conrelid = 'public.appointments'::regclass
  and conname = 'appointments_staff_occupied_excl';

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('appointments', 'customers', 'customer_packages', 'package_redemptions', 'staff', 'staff_services', 'staff_weekly_hours', 'staff_time_off', 'notifications')
order by tablename;
```

In the clone, use two distinct customer identities and one non-admin identity. Demonstrate that customer A cannot read or mutate customer B’s data, the non-admin cannot mutate admin resources, and browser roles cannot read/write notifications. Use a deliberate same-staff, same-slot race and record one accepted result plus one conflict result. Repeat these checks in production only with authorised disposable data and an approved cleanup plan.

## First administrator and staff onboarding

1. Create the owner identity in Supabase Auth through the authorised console; never record their personal details here.
2. Insert or reactivate the matching UUID in `public.admin_users` with `is_active` true. The operation must be audited and a final active administrator must remain.
3. Sign in at `/admin/login` and verify `/admin` loads for that owner; verify a normal user is refused.
4. Create each staff member in the Staff module. Assign only services they can perform, set the active state, all seven weekly hours, and explicit rest/time-off ranges. Use the public availability view to verify both a specified staff member and “any staff”.
5. Publish only approved services and package mappings. Test an admin creation and status change, then confirm the audit entry.
6. Enter only approved site content. If contact fields are absent or invalid, leave them absent: phone, WhatsApp, email, Instagram, address, and address note are deliberately hidden.

## Daily operations

- At opening, review today's calendar, pending bookings, staff absences, expiring packages, and failed/pending notification outcomes.
- Use the calendar’s create/reschedule/cancel/status actions, rather than direct table writes. Confirm a changed appointment still has the right staff, time, status, package state, and audit record.
- Use rest/time-off for breaks and exceptional absence; do not delete historical appointments to make a schedule appear free.
- After each package-related cancellation, verify a session is restored at most once. Investigate any persisted notification warning; a successful booking is not reverted just because sending failed.
- Before closing, review booking conflicts, failed notification outcomes, unusual admin audit events, and the backup status.

## Temporarily stop new public bookings

For an incident, keep all existing `appointments` intact. In the admin scheduling/settings workflow, set the business hours to closed for every weekday; the availability/atomic booking command will then offer no public slots and reject new submissions. Record the start time and operator. Do not cancel or delete existing appointments as the shutdown action.

This also prevents ordinary admin scheduling through the same availability rules, so coordinate manual handling of existing appointments. Reopen only the reviewed business-hour rows after the fault is resolved and run an availability smoke. If application-level emergency maintenance is required, restore the last known-good application deployment while retaining the additive schema; do not attempt a destructive database rollback.

## Rollback and recovery

1. Declare no-go, stop new availability as above, and preserve logs/audit evidence without customer data in the release record.
2. Restore the last known-good application deployment only after checking its compatibility with the already-applied additive schema.
3. Keep applied schema changes. Diagnose with the backup/clone, then ship a reviewed forward-only migration; never delete columns, tables, appointments, package redemptions, or audit rows as a rollback shortcut.
4. If the migration itself has not committed, confirm the target migration state before retrying. If it committed, use the post-migration verification queries and a new repair migration.
5. Resume bookings only after the affected preview/production smoke rows pass and the release owner records GO.

## Isolated E2E provisioning

Create a dedicated, non-production database whose URL is loopback or explicitly contains `e2e`/`test`, apply the full migration chain, create one non-test active bootstrap administrator, and set `app_settings.data.e2e_marker` to a unique marker. Put these names in an untracked `.env.e2e.local`: `E2E_BASE_URL`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_DATABASE_MARKER`, `E2E_TEST_PASSWORD`, `E2E_PROBE_ENABLED`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Use separate terminals:

```powershell
npm run start:e2e
npm run test:e2e -- --project=chromium
```

The suite validates the marked database and guarded application probe before navigation, creates namespaced fixtures, and restores business settings during cleanup. To remove a failed local fixture run only after the same preflight succeeds, use:

```powershell
npm run cleanup:e2e
```

Never point these commands at a preview or production target.
