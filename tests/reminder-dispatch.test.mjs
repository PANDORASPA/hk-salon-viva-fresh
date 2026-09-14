import assert from 'node:assert/strict'
import test from 'node:test'

import { dispatchReminders, reminderWindow } from '../lib/notifications/reminders.js'

function reminderDb({ appointment, claim }) {
  const seen = { ranges: [], claims: [], updates: [] }
  return {
    seen,
    from(table) {
      if (table === 'appointments') {
        const chain = {
          select: () => chain, in: (_column, statuses) => (seen.statuses = statuses, chain),
          gte: (_column, value) => (seen.ranges.push(value), chain), lt: (_column, value) => (seen.ranges.push(value), chain),
          order: async () => ({ data: [appointment], error: null }),
        }
        return chain
      }
      return { update: patch => ({ eq: async (_column, id) => (seen.updates.push({ id, patch }), { error: null }) }) }
    },
    async rpc(name, args) { seen.claims.push({ name, args }); return { data: claim, error: null } },
  }
}

test('reminder dispatch uses a one-hour HK-safe instant window and records a provider message id', async () => {
  // Mutation caught: a two-hour/read-before-send job can overlap retries and
  // double-send around a Hong Kong day boundary.
  const now = new Date('2026-09-14T15:30:00.000Z') // 23:30 in Hong Kong
  const appointment = { id: 9, starts_at: '2026-09-15T15:30:00.000Z', status: 'confirmed', customer_name: 'Ada', customer_email: 'ada@example.test', services: { name: 'Treatment' } }
  const db = reminderDb({ appointment, claim: [{ notification_id: 77, claimed: true }] })
  const sent = []
  const result = await dispatchReminders({ db, now, settings: { reminder_hours_before: 24, cancel_cutoff_hours: 24 }, sendEmail: async input => (sent.push(input), { ok: true, status: 'sent', id: 'provider-77' }) })

  assert.deepEqual(db.seen.statuses, ['pending', 'confirmed'])
  assert.deepEqual(db.seen.ranges, ['2026-09-15T15:30:00.000Z', '2026-09-15T16:30:00.000Z'])
  assert.equal(db.seen.claims[0].name, 'claim_reminder_notification')
  assert.equal(db.seen.claims[0].args.p_reminder_window_hours, 24)
  assert.equal(sent.length, 1)
  assert.deepEqual(result, { checked: 1, sent: 1, dry_run: 0, skipped: 0, failed: 0, items: [{ id: 9, status: 'sent', messageId: 'provider-77' }] })
  assert.deepEqual(db.seen.updates, [{ id: 77, patch: { channel_results: { email: { ok: true, status: 'sent', id: 'provider-77' } } } }])
})

test('an already claimed reminder is never handed to a provider again', async () => {
  const appointment = { id: 10, starts_at: '2026-09-16T00:00:00.000Z', status: 'pending', customer_name: 'Ada', customer_email: 'ada@example.test', services: { name: 'Treatment' } }
  const db = reminderDb({ appointment, claim: [{ notification_id: null, claimed: false }] })
  const result = await dispatchReminders({ db, now: new Date('2026-09-15T00:00:00.000Z'), settings: { reminder_hours_before: 24 }, sendEmail: async () => assert.fail('provider must not be called') })
  assert.equal(result.skipped, 1)
  assert.equal(result.items[0].status, 'already_claimed')
})

test('reminder windows are exact UTC instants while rendered appointments stay Hong Kong-local', () => {
  const { start, end } = reminderWindow(new Date('2026-09-14T15:30:00.000Z'), 24)
  assert.equal(start.toISOString(), '2026-09-15T15:30:00.000Z')
  assert.equal(end.toISOString(), '2026-09-15T16:30:00.000Z')
})
