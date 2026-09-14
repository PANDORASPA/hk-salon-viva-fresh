# Isolated E2E environment

The E2E suite only operates on a dedicated database. It never accepts production
or preview URLs: both `E2E_BASE_URL` and `E2E_SUPABASE_URL` must be localhost or
explicitly include `e2e`/`test` in their hostname.

Before first use, create an isolated database with all migrations applied, set
`app_settings.id = 1` data to include a unique `e2e_marker`, and keep one
non-test active bootstrap administrator. The bootstrap account is intentional:
the database prevents removal of its final active administrator, while cleanup
removes the namespaced test administrator safely.

Set these values in a local, uncommitted .env.e2e.local file. Playwright and
the seed commands load it explicitly and fill only unset environment variables.

```
E2E_BASE_URL=http://127.0.0.1:3100
E2E_SUPABASE_URL=http://127.0.0.1:54321
E2E_SUPABASE_SERVICE_ROLE_KEY=<isolated-test-service-role-key>
E2E_DATABASE_MARKER=<exact-app-settings-e2e-marker>
E2E_TEST_PASSWORD=<at-least-12-character-test-password>
E2E_PROBE_ENABLED=1
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<isolated-test-service-role-key>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<isolated-test-publishable-key>
```

In one terminal, start the isolated development server with the same local file:

```
npm run start:e2e
```

This cross-platform launcher loads `.env.e2e.local`, requires an HTTP loopback
base URL (ordinary `next dev` does not configure HTTPS), matching public/service
Supabase settings, at least one public publishable/anon key, and
`E2E_PROBE_ENABLED=1`; it runs `next dev`, never `next start`. In a second
terminal, run:

```
npm run test:e2e
```

Global setup verifies both the marked Supabase database and
the guarded /api/e2e probe before any browser navigation. It seeds once and
global teardown removes fixtures and restores business hours/settings. The
test dates are independent, so staff-hours changes cannot pollute concurrency.
