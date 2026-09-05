# PANDORA HEAD SPA Launch Checklist

Use [`PALACEHAIRSPA_REPLACEMENT_ACCEPTANCE.md`](./PALACEHAIRSPA_REPLACEMENT_ACCEPTANCE.md) as the acceptance board for the Palace Hair Spa replacement and PANDORA HEAD SPA launch readiness.

## Environment

- Confirm `.env.local` or hosting secrets point to the intended production Supabase project.
- Confirm Stripe production payment variables are set:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_CURRENCY`
  - `NEXT_PUBLIC_SITE_URL`
- Confirm `supabase/migrations` is the only official schema source going forward.

## Database

- Apply canonical migrations in filename order to staging, then production.
- Confirm core tables exist: `member_profiles`, `bookings`, `orders`, `tickets`, `user_tickets`, `ticket_redemptions`, staff availability tables, content tables, and admin settings tables.
- Confirm at least one admin row exists in `member_profiles`.
- Confirm service role keys are used only inside server routes and never exposed to client code.
- Decide whether production content is entered manually or loaded from reviewed sample content.

## Stripe

- Run a test-card package payment: package purchase -> Checkout success -> webhook -> `user_tickets` issued -> package appears in `/account/tickets`.
- Run a cancelled Checkout: order remains unpaid and no package is issued.
- Re-send the webhook event and confirm no duplicate package is issued.
- Run a product order and confirm Stripe success marks the order `completed`.
- Confirm admin order views show payment method, status, order reference, and enough context for reconciliation.

## Accounts And Roles

- Verify the intended admin account can log into `/admin`.
- Verify a normal member account is redirected away from `/admin`.
- Verify a new member signup creates a `member_profiles` row automatically.

## Core Flows

- Booking:
  - Log in as a member.
  - Create a head spa booking.
  - Confirm it appears in `/account/bookings`.
  - Cancel or reschedule it and confirm only that member can change it.
- Packages:
  - Purchase a package with Stripe.
  - Purchase a package with manual payment and confirm admin approval issues the package.
  - Book with a valid package and confirm the amount is `$0`.
  - Confirm one package count is deducted and recorded in `ticket_redemptions`.
  - Cancel the package booking and confirm one count is restored.
- Admin:
  - Confirm bookings, orders, customers, services, packages, CSV import, and settings load in `/admin`.
  - Confirm booking details show whether a package was used.

## Content

- Replace remaining placeholder copy with approved PANDORA HEAD SPA information.
- Confirm services, staff, packages, FAQs, and articles reflect current head spa business data.
- Confirm phone, address, hours, map, WhatsApp, and social links are production-ready.
- Search public code and documents for broken text, `VIVA`, `Hair Salon`, `剪髮`, `美髮`, `demo`, and `test` wording before launch.

## SEO And Mobile

- Confirm sitemap, robots, canonical URL, Open Graph metadata, and sharing image load on the production domain.
- Confirm public page titles and descriptions are production-ready.
- Check 390px, 430px, and 1440px widths for overlap, hidden controls, and unusable forms.
- Confirm mobile users can purchase a package, view package balance, and book using a package.

## Build And Release

- Run `npm run build` and save the latest successful output.
- Run the live smoke scripts against staging and production-like URLs:
  - `npm run smoke:phase2:live -- --base-url=<staging-url>`
  - `npm run smoke:release-gate -- --base-url=<staging-url>`
- Keep a copy of the current migration state and linked project ref before any future schema changes.

## Rollback Notes

- Do not edit root-level legacy SQL files as the live schema source.
- If a future schema change fails, create a new forward migration instead of editing already-applied migrations.
- Keep production content changes separate from schema migrations whenever possible.
