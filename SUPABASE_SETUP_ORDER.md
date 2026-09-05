# Supabase Setup Order

The canonical database source now lives under [`supabase/migrations`](./supabase/migrations). The root-level SQL files remain in the repository only as legacy reference material from the pre-migration cleanup stage.

## Canonical Migration Order

Apply the files in filename order:

1. [`supabase/migrations/20260318000100_baseline_core_schema.sql`](./supabase/migrations/20260318000100_baseline_core_schema.sql)
   - Creates the current baseline business tables, core indexes, and public read policies.
   - Excludes demo content.

2. [`supabase/migrations/20260318000200_booking_v2.sql`](./supabase/migrations/20260318000200_booking_v2.sql)
   - Adds booking v2 normalization, overlap protection, and scheduling helper tables.

3. [`supabase/migrations/20260318000300_auth_membership.sql`](./supabase/migrations/20260318000300_auth_membership.sql)
   - Creates `member_profiles`, auth trigger wiring, and member-owned booking/profile policies.

4. [`supabase/migrations/20260318000400_admin_auth_rls.sql`](./supabase/migrations/20260318000400_admin_auth_rls.sql)
   - Adds admin flags and the RLS policies used by the current admin and member flows.

5. [`supabase/migrations/20260318000500_signup_resilience.sql`](./supabase/migrations/20260318000500_signup_resilience.sql)
   - Hardens signup/profile trigger behavior for live auth flows.

6. [`supabase/migrations/20260318000600_booking_timestamp_guard.sql`](./supabase/migrations/20260318000600_booking_timestamp_guard.sql)
   - Adds timestamp guards used by booking normalization and overlap detection.

7. [`supabase/migrations/20260318000700_admin_schedule_rls.sql`](./supabase/migrations/20260318000700_admin_schedule_rls.sql)
   - Adds schedule-related RLS coverage for the admin scheduling surface.

8. [`supabase/migrations/20260318000800_admin_policy_helper.sql`](./supabase/migrations/20260318000800_admin_policy_helper.sql)
   - Introduces the admin helper function used to avoid recursive policy checks.

9. [`supabase/migrations/20260318000900_backfill_partial_staff_schedule.sql`](./supabase/migrations/20260318000900_backfill_partial_staff_schedule.sql)
   - Repairs partial weekly staff schedule rows from earlier admin data.

10. [`supabase/migrations/20260319000100_schedule_guardrails.sql`](./supabase/migrations/20260319000100_schedule_guardrails.sql)
   - Adds schedule validation guardrails before the operational expansion.

11. [`supabase/migrations/20260319000200_booking_lifecycle_guardrails.sql`](./supabase/migrations/20260319000200_booking_lifecycle_guardrails.sql)
   - Adds lifecycle checks around booking creation and status changes.

12. [`supabase/migrations/20260319000300_operational_foundation.sql`](./supabase/migrations/20260319000300_operational_foundation.sql)
   - Creates the phase 1 operational foundation tables such as locations, provider groups, holidays, resources, and transactions.

13. [`supabase/migrations/20260319000400_phase2_booking_rules_foundation.sql`](./supabase/migrations/20260319000400_phase2_booking_rules_foundation.sql)
   - Bridges the operational foundation into phase 2 booking rules with nullable relation columns, constraints, indexes, and public/admin policies for location, provider-group, and resource-aware booking logic.

## Optional Seed

- [`supabase/seed.sql`](./supabase/seed.sql) contains clean demo content for local development and internal demos.
- Do not treat the seed file as production content.
- Fresh production setup should run migrations first, then only run selected data imports that reflect real shop content.

## Recommended Fresh Setup

1. Create a clean Supabase project or reset a development database.
2. Apply the files in `supabase/migrations` in filename order.
3. Optionally run `supabase/seed.sql` for demo or development content.
4. Create or register at least one member account through the app.
5. Mark one row in `member_profiles` as admin:

```sql
update public.member_profiles
set is_admin = true
where email = 'you@example.com';
```

6. Verify `/account`, booking, product order, ticket purchase, and `/admin`.

## Legacy SQL Status

- [`supabase-setup.sql`](./supabase-setup.sql), [`sql-update.sql`](./sql-update.sql), [`sql-booking-v2.sql`](./sql-booking-v2.sql), [`sql-auth-membership.sql`](./sql-auth-membership.sql), and [`sql-admin-auth-rls.sql`](./sql-admin-auth-rls.sql) are now legacy source material.
- They should not be used as the fresh setup path going forward.
- [`sql-fix-permissions.sql`](./sql-fix-permissions.sql) remains an emergency legacy repair script and must not be used as part of a clean baseline.

## Compatibility Notes

- `bookings` still keeps legacy `date` and `time` fields for compatibility, but new work should treat `appointment_date`, `start_time`, `end_time`, and `buffer_end_time` as source of truth.
- `orders.member_user_id` and `user_tickets.member_user_id` are the current member ownership fields used by the app.
- `staff.location_id`, `staff.provider_group_id`, `services.default_location_id`, and `services.default_provider_group_id` are phase 2 compatibility columns that allow the booking engine to evolve without breaking existing staff JSON schedule data.
- `bookings.location_id`, `bookings.provider_group_id`, `orders.location_id`, and `transactions.location_id/provider_group_id/resource_id` are phase 2 bridge columns for multi-location and resource-aware operations.
- `users` is a historical table from the legacy schema and is not the active member identity source.
