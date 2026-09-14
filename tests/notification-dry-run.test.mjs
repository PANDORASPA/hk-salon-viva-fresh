import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveNotificationDryRun } from '../lib/notifications/dry-run.js'

test('NOTIFY_DRY_RUN truth table preserves saved settings unless explicitly overridden', () => {
  const cases = [
    { value: undefined, saved: true, expected: true },
    { value: undefined, saved: false, expected: false },
    { value: '1', saved: false, expected: true },
    { value: '1', saved: true, expected: true },
    { value: '0', saved: true, expected: false },
    { value: '0', saved: false, expected: false },
  ]

  for (const { value, saved, expected } of cases) {
    assert.equal(resolveNotificationDryRun(value, saved), expected, `NOTIFY_DRY_RUN=${value ?? 'unset'}, saved=${saved}`)
  }
})
