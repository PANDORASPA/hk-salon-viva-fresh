# Salon Poke Bristol Admin Rebuild Design

## Goal

Rebuild the current Salon Poke Bristol website as a maintainable Git-backed Next.js application while preserving the public site's appearance, copy, images, routes, and production URL. Add a secure, deliberately small administration area for appointments, services, opening hours, blocked dates, gallery images, site content, and administrator accounts.

## Source of truth

- The live site at `https://lo-chan-hair-bristol.vercel.app` is authoritative for Salon Poke branding, public copy, images, navigation, and public routes.
- `PANDORASPA/Hair-salon` is authoritative for proven Next.js, Supabase session, booking, authorization, audit, and deployment patterns.
- The rebuilt application will remove Pandora-specific products, inventory, tickets, Stripe, coupons, multi-location, and other unrelated operations from the Salon Poke user experience.

## Architecture

Use Next.js App Router with server-side Supabase session validation. Public pages read published salon data using narrowly scoped anonymous RLS policies. Customer booking creation goes through a validated server route. Admin pages and mutations require an authenticated user whose immutable authorization record grants the `admin` role. Administrative writes are performed through server routes and protected database policies; no service-role secret is exposed to the browser.

Production will remain untouched until a Preview deployment passes automated tests and browser verification. The completed source will live in GitHub and the Vercel project will be connected to that repository so every future production build is reproducible.

## Public website

Preserve these routes and their current purpose: `/`, `/services`, `/booking`, `/gallery`, `/about`, `/location`, `/contact`, `/signin`, `/signup`, `/account`, `/terms`, and `/privacy`. Preserve the Salon Poke Bristol visual identity, responsive navigation, WhatsApp contact path, and current public imagery. Content managed by the admin will have safe built-in defaults so the site remains readable during database outages.

## Administration area

`/admin` has a dedicated sign-in screen and a protected application shell. It contains six focused modules:

1. Appointments: list and filter bookings; view customer and service details; confirm, cancel, reschedule, and add internal notes.
2. Services: create, edit, reorder, publish/unpublish, and set price, duration, category, and description.
3. Schedule: edit weekly opening hours and define exceptional blocked dates or date ranges.
4. Gallery: upload, caption, reorder, publish/unpublish, and delete images stored in a private-management/public-read Supabase Storage bucket.
5. Site content: edit salon identity, hero/about copy, contact details, WhatsApp, email, address guidance, Instagram, map URL, booking notices, and other approved text fields.
6. Administrators: list admins, invite or promote an authenticated user, and revoke admin access while preventing removal of the final active admin.

## Data model

- `profiles`: customer profile associated one-to-one with `auth.users`.
- `admin_users`: immutable authorization relation keyed by auth user ID, including active state and audit timestamps.
- `services`: public service catalogue with price in pence, duration, category, ordering, and publication state.
- `appointments`: customer contact, selected service, start/end timestamps, status, notes, and optional authenticated customer ID.
- `business_hours`: one row per weekday containing open/closed state and local opening/closing time.
- `blocked_dates`: exceptional closures with date range and reason.
- `gallery_images`: Storage object path, alt text, caption, ordering, and publication state.
- `site_content`: singleton validated JSON document for editable public copy and contact settings.
- `admin_audit_logs`: actor, action, entity, entity ID, safe metadata, and timestamp for administrative mutations.

All public-schema tables have RLS enabled. Anonymous access is read-only and limited to published public fields. Customers can read their own appointments. Admin access checks `admin_users`, not user-editable metadata. Storage policies permit public reads only from the gallery bucket and authenticated admin writes.

## Booking rules

Times are stored as timezone-aware timestamps and interpreted in `Europe/London`, including daylight-saving changes. Availability combines weekly hours, blocked dates, service duration, existing non-cancelled appointments, and a configurable buffer. Creation rechecks availability transactionally to prevent double booking. Appointment status is limited to `pending`, `confirmed`, `completed`, `cancelled`, and `no_show`.

## Failure handling

Public pages retain safe default content when optional content queries fail. Booking and admin mutations return field-level validation errors without exposing internal details. Unauthorized requests redirect to admin sign-in or return 401/403 from APIs. Storage failures do not create gallery database rows. Destructive admin actions require an explicit confirmation in the UI and create an audit entry.

## Testing and verification

- Unit tests cover validation, availability, timezone behavior, admin authorization, and content mapping.
- Integration tests cover RLS-sensitive server routes and appointment conflicts.
- Production build, dependency audit, and the repository security scan must pass.
- Browser verification covers every public route, mobile navigation, admin sign-in protection, each admin module's critical create/update flow, booking creation, and confirmation that ordinary users cannot enter `/admin`.
- Preview is tested first. Production promotion occurs only after Preview passes and the current production deployment remains available as rollback.

## Deployment and credentials

Create or connect a Supabase project controlled by the user and apply versioned migrations. Vercel Preview and Production require `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anon key if the project only provides it), `SUPABASE_SERVICE_ROLE_KEY` for server-only administrative provisioning where strictly necessary, and `NEXT_PUBLIC_SITE_URL`. The initial admin account is created through Supabase Auth and promoted through a controlled bootstrap operation; no password is committed or displayed in source control.

## Acceptance criteria

- The public production URL retains the Salon Poke website and its existing core content and routes.
- A valid admin can use all six modules; an anonymous visitor and ordinary customer cannot.
- A customer can submit a valid appointment without double booking.
- Content, services, schedule, and gallery edits become visible publicly as designed.
- Source, migrations, lockfile, and operating documentation are committed to GitHub.
- Vercel is Git-connected, Preview is verified, Production is healthy, and rollback remains available.
