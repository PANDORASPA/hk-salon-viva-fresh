# VIVA HAIR Validation Report

## Verified

- Workspace is linked to Supabase project `khjjvjufwbmqymgzhbkl` (`Viva hair salon`).
- Remote migration history matches local migrations:
  - `20260318000100`
  - `20260318000200`
  - `20260318000300`
  - `20260318000400`
- Remote signup fix migration is applied:
  - `20260318000500`
- Remote booking guard migration is applied:
  - `20260318000600`
- Local `.env.local` now points to the current Supabase project URL and keys.
- `supabase/config.toml` was aligned with the linked project's auth settings to reduce CLI config drift warnings.
- `npm run build` completes successfully.
- A real admin profile exists:
  - `salonmmchk@gmail.com`
  - `is_admin = true`
- Core tables are reachable from the live project:
  - `member_profiles`
  - `bookings`
  - `orders`
  - `user_tickets`
  - `staff_shifts`
  - `staff_breaks`
  - `staff_time_off`
  - `blocked_slots`
- Live member signup now succeeds again.
- Signup automatically creates a matching `member_profiles` row.
- Live booking rows can now persist normalized timestamp fields used by overlap protection.
- Live overlap protection now blocks duplicate staff/time bookings with the `bookings_no_overlap` exclusion constraint.
- Live test inserts succeeded for:
  - booking row creation
  - `user_tickets` row creation
  - `orders` row creation

## Latest Validation

- `auth.signUp(...)` now succeeds against the live project.
- A fresh test account was created successfully.
- The linked `member_profiles` row is present immediately after signup.
- Current profile sync creates the row reliably, but profile fields such as `full_name` and `phone` are still `null` until the app updates them later.
- The live `orders` schema differs from the original baseline migration:
  - missing `name`
  - missing `phone`
  - missing `product_name`
- The app has been updated to use the live-compatible `orders.user_name` + `items` shape.
- Staff scheduling also required live-schema compatibility for `staff.daysoff`.
- Ticket usage now supports both service-specific tickets and generic tickets with no `service_id`.

## Impact

- Existing admin access continues to work.
- New member registration is no longer blocked at the Auth/database layer.
- End-to-end live validation can now continue with:
  - account access
  - booking creation
  - ticket purchase
  - product order
- Database-level booking collision protection is no longer a blind spot.

## Recommended Next Check

1. Re-run a full live member journey:
   - member registration
   - account access
   - booking creation
   - ticket purchase
   - product order
2. Verify the app updates `member_profiles.full_name` and `member_profiles.phone` as expected after registration/profile save.
3. Manually verify the browser-based checkout and booking UI against the now-fixed live schema:
   - product checkout modal -> `/api/orders/create`
   - booking page ticket selection
   - account booking list / reschedule
4. Validate admin-side schedule changes against live availability blocking:
   - shop `days_off`
   - staff weekly schedule
   - date-specific `staff_shifts`
   - `blocked_slots`
5. Manually verify non-admin users are redirected away from `/admin`.
