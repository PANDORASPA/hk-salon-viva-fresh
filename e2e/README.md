# Isolated E2E environment

The E2E suite only operates on a dedicated database. It never accepts production
or preview URLs: both `E2E_BASE_URL` and `E2E_SUPABASE_URL` must be localhost or
explicitly include `e2e`/`test` in their hostname.

Before first use, create an isolated database with all migrations applied, set
`app_settings.id = 1` data to include a unique `e2e_marker`, and keep one
non-test active bootstrap administrator. The bootstrap account is intentional:
the database prevents removal of its final active administrator, while cleanup
removes the namespaced test administrator safely.

Set these values in a local, uncommitted environment file:

```
E2E_BASE_URL=http://127.0.0.1:3100
E2E_SUPABASE_URL=http://127.0.0.1:54321
E2E_SUPABASE_SERVICE_ROLE_KEY=<isolated-test-service-role-key>
E2E_DATABASE_MARKER=<exact-app-settings-e2e-marker>
E2E_TEST_PASSWORD=<at-least-12-character-test-password>
NEXT_PUBLIC_SUPABASE_URL=$E2E_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$E2E_SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<isolated-test-publishable-key>
```

Run `npm run seed:e2e`, start the app with the corresponding isolated
`NEXT_PUBLIC_*` settings, run `npm run test:e2e -- --project=chromium`, then
run `npm run cleanup:e2e`. The tests use the `e2e_booking_platform` namespace
by default; override it with `E2E_NAMESPACE` only for a separate isolated run.
