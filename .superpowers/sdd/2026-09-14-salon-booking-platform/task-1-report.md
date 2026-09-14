# Task 1 report: clean baseline and test harness

## Implementation

- Added `tests/booking-platform-baseline.test.mjs`.
  - Verifies the stable `test:unit` interface.
  - Exercises the canonical availability module with an appointment occupying a slot.
  - Exercises package lookup through the booking package module and asserts the runtime table boundary is `customer_packages`, never the legacy `bookings` table.
- Added stable scripts to `package.json`:
  - `test:unit`: `node --test tests/*.test.mjs`
  - `test:e2e`: `playwright test`
  - `test`: `npm run test:unit`
- Installed `@playwright/test` with `npm install --save-dev @playwright/test`; `package-lock.json` is included.
- Inspected the local Next.js 16 route-handler documentation. The installed 16.3.4 package stores it at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (the brief’s `.mdx` path is not present).

## TDD evidence

### RED

Command:

```powershell
node --test tests/booking-platform-baseline.test.mjs
```

Relevant result before implementation:

```text
not ok 1 - the unit-test interface is stable for the booking platform
Expected values to be strictly equal:
+ actual - expected
+ undefined
- 'node --test tests/*.test.mjs'
1..2
# tests 2
# pass 0
# fail 2
```

The initial route-import attempt also failed because direct Node ESM loading cannot resolve this Next package’s extensionless `next/server` import (`ERR_MODULE_NOT_FOUND`). The final test therefore uses executable canonical booking-module behavior rather than making source grep the proof.

### GREEN

Focused command:

```powershell
node --test tests/booking-platform-baseline.test.mjs
```

Result:

```text
1..2
# tests 2
# pass 2
# fail 0
```

Full unit command:

```powershell
npm run test:unit
```

Result:

```text
1..116
# tests 116
# pass 116
# fail 0
```

The output includes the repository’s pre-existing `MODULE_TYPELESS_PACKAGE_JSON` warnings.

Additional verification:

```powershell
npm run build
```

Completed successfully. Next emitted the existing custom Cache-Control warning and unresolved optional dynamic-import warnings for `resend` and `stripe`.

```powershell
npm run security:scan
```

Failed on the existing findings in `lib/payments/stripe.js` and README documentation (service-role, Stripe secret, and webhook-secret patterns).

## Self-review

- The test is behavior-based: it runs real availability and package-lookup logic against a small in-memory client, rather than treating source text as the contract.
- The stable test scripts match the requested names and `test` delegates to `test:unit`.
- No production booking logic was changed.
- No new warnings were intentionally introduced.

## Concerns

- `node --test` cannot directly import the Next route handlers because the current package uses extensionless `next/server` imports; Next’s production build compiles all canonical routes successfully.
- The security scan remains red on pre-existing secret-pattern findings and is outside this baseline task.
- Existing `MODULE_TYPELESS_PACKAGE_JSON` warnings remain, as requested; cleanup is outside this task.
