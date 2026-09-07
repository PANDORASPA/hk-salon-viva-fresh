import assert from 'node:assert/strict'
import test from 'node:test'

import appSettings from '../lib/settings/app-settings.js'
const { mergeSettings, readAppSettings, DEFAULTS, __testing } = appSettings

test('mergeSettings returns the full defaults when input is empty', () => {
  const out = mergeSettings({})
  assert.equal(out.reminder_hours_before, 24)
  assert.equal(out.cancel_cutoff_hours, 24)
  assert.equal(out.notify_email_enabled, true)
  assert.equal(out.notify_whatsapp_enabled, false)
  assert.equal(out.notify_dry_run, true)
  assert.equal(out.auto_issue_packages, true)
})

test('mergeSettings drops unknown keys', () => {
  const out = mergeSettings({ reminder_hours_before: 48, hacker: 'lol' })
  assert.equal(out.reminder_hours_before, 48)
  assert.equal(Object.prototype.hasOwnProperty.call(out, 'hacker'), false)
})

test('mergeSettings coerces booleans from strings', () => {
  assert.equal(mergeSettings({ notify_email_enabled: 'false' }).notify_email_enabled, false)
  assert.equal(mergeSettings({ notify_email_enabled: '1' }).notify_email_enabled, true)
  assert.equal(mergeSettings({ notify_email_enabled: 0 }).notify_email_enabled, false)
})

test('mergeSettings clamps invalid numerics to defaults', () => {
  assert.equal(mergeSettings({ cancel_cutoff_hours: -5 }).cancel_cutoff_hours, DEFAULTS.cancel_cutoff_hours)
  assert.equal(mergeSettings({ cancel_cutoff_hours: 'not-a-number' }).cancel_cutoff_hours, DEFAULTS.cancel_cutoff_hours)
  assert.equal(mergeSettings({ cancel_cutoff_hours: 0 }).cancel_cutoff_hours, 0)
})

test('mergeSettings ignores arrays and primitives', () => {
  assert.deepEqual(mergeSettings([]), DEFAULTS)
  assert.deepEqual(mergeSettings(null), DEFAULTS)
  assert.deepEqual(mergeSettings('nope'), DEFAULTS)
})

test('readAppSettings returns defaults when client is missing', async () => {
  const out = await readAppSettings(null)
  assert.deepEqual(out, { ...DEFAULTS })
})

test('readAppSettings returns defaults when the table is empty', async () => {
  const fakeDb = { from() { return { select() { return { eq() { return { maybeSingle: async () => ({ data: null, error: null }) } } } } } } }
  const out = await readAppSettings(fakeDb)
  assert.equal(out.cancel_cutoff_hours, 24)
})

test('readAppSettings merges stored JSONB blob with defaults', async () => {
  const fakeDb = {
    from() {
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: async () => ({ data: { data: { cancel_cutoff_hours: 48, notify_email_enabled: false } }, error: null }) }
            },
          }
        },
      }
    },
  }
  const out = await readAppSettings(fakeDb)
  assert.equal(out.cancel_cutoff_hours, 48)
  assert.equal(out.notify_email_enabled, false)
  // other keys still at default
  assert.equal(out.reminder_hours_before, 24)
  assert.equal(out.notify_whatsapp_enabled, false)
})

test('readAppSettings swallows thrown errors and returns defaults', async () => {
  const fakeDb = { from() { throw new Error('boom') } }
  const out = await readAppSettings(fakeDb)
  assert.equal(out.cancel_cutoff_hours, 24)
})

test('normaliseKey leaves unknown keys untouched (defensive)', () => {
  assert.equal(__testing.normaliseKey('mystery', 'x'), 'x')
})
