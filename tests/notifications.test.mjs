import assert from 'node:assert/strict'
import test from 'node:test'

import notify from '../lib/notifications/notify.js'
const { sendBookingNotification, __testing } = notify
const { render, formatHkTime } = __testing

function notificationClient(rows, failUpdate = false) {
  return { from(table) {
    if (table === 'app_settings') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
    return {
      insert: record => ({ select: () => ({ single: async () => { const row = { id: rows.length + 1, ...record }; rows.push(row); return { data: row, error: null } } }) }),
      update: patch => ({ eq: async (_key, id) => failUpdate ? { error: new Error('outcome write failed') } : (Object.assign(rows.find(row => row.id === id), patch), { error: null }) }),
    }
  } }
}

test('formatHkTime returns null/undefined safe labels and Asia/Hong_Kong output', () => {
  assert.equal(formatHkTime(null), '時間待確認')
  assert.equal(formatHkTime('not-a-date'), '時間待確認')
  // 2026-09-08T14:30 UTC is 22:30 HKT (UTC+8). Assert structurally rather
  // than on CJK glyphs so the test survives terminal-encoding changes.
  const out = formatHkTime('2026-09-08T14:30:00.000Z')
  assert.match(out, /2026/)
  assert.match(out, /22:30/)
  assert.ok(out.length > 8)
})

test('render booking_confirmation includes customer name, booking id, and service', () => {
  const ctx = {
    booking: { id: 42, customer_name: 'Ada Wong', customer_phone: '91234567' },
    service: { name: '爆毛術護理' },
    customerName: 'Ada Wong',
    customerPhone: '91234567',
    startsAtHkd: '2026年9月8日 星期二 22:30',
  }
  const out = render('booking_confirmation', ctx)
  assert.equal(out.whatsapp.to, '91234567')
  assert.match(out.whatsapp.body, /Ada Wong/)
  assert.match(out.whatsapp.body, /#42/)
  assert.match(out.whatsapp.body, /爆毛術護理/)
  assert.match(out.whatsapp.body, /SALON POKE BY VIVA/)
})

test('render booking_cancellation mentions refund when packageRefunded is true', () => {
  const ctx = {
    booking: { id: 7, customer_name: 'Ada', customer_phone: '91234567' },
    customerName: 'Ada',
    customerPhone: '91234567',
    startsAtHkd: '2026年9月8日 22:30',
    packageRefunded: true,
  }
  const out = render('booking_cancellation', ctx)
  assert.match(out.whatsapp.body, /退返/)
  const noRefund = render('booking_cancellation', { ...ctx, packageRefunded: false })
  assert.doesNotMatch(noRefund.whatsapp.body, /退返/)
})

test('render booking_reschedule mentions previous and new time', () => {
  const ctx = {
    booking: { id: 5, customer_name: 'Ada', customer_phone: '91234567' },
    customerName: 'Ada',
    customerPhone: '91234567',
    startsAtHkd: '新時間',
    prevStartsAtHkd: '舊時間',
  }
  const out = render('booking_reschedule', ctx)
  assert.match(out.whatsapp.body, /舊時間/)
  assert.match(out.whatsapp.body, /新時間/)
})

test('reschedule notification preserves package usage and omits an unknown previous time', () => {
  const output = render('booking_reschedule', { booking:{id:5,customer_package_id:1},
    customerName:'Ada', startsAtHkd:'新時間', prevStartsAtHkd:null })
  for (const body of [output.whatsapp.body, output.email.body]) {
    assert.match(body, /新時間/)
    assert.doesNotMatch(body, /null|undefined|重新扣減/)
    assert.match(body, /原本/)
  }
})

test('sendBookingNotification returns no_contact when both phone and email missing', async () => {
  const result = await sendBookingNotification({
    event: 'booking_confirmation',
    booking: { id: 1, customer_name: 'Anon' },
    service: { name: 'Test' },
  })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'no_contact')
})

test('sendBookingNotification logs to console + supabase (dry run)', async () => {
  // Capture console.log output
  const logs = []
  const orig = console.log
  const rows = []
  __testing.setServiceClient(notificationClient(rows))
  console.log = (...args) => logs.push(args.join(' '))
  try {
    const result = await sendBookingNotification({
      event: 'booking_confirmation',
      booking: {
        id: 99,
        customer_name: 'Ada',
        customer_phone: '91234567',
        customer_email: 'ada@example.com',
        starts_at: '2026-09-08T14:30:00.000Z',
      },
      service: { name: 'Test Service' },
    })
    assert.equal(result.ok, true)
    assert.ok(result.channels.includes('console'))
    assert.ok(result.channels.includes('supabase'))
    assert.equal(result.outcomePersisted, true)
    assert.equal(rows[0].channel_results.console.ok, true)
    assert.ok(logs.some((line) => /\[notify\]/.test(line)))
    assert.ok(logs.some((line) => /whatsapp\.body/.test(line)))
  } finally {
    console.log = orig
    __testing.setServiceClient(null)
  }
})

test('sendBookingNotification leaves a durable pending marker when the final channel-result update fails', async () => {
  // Mutation caught: inserting the notification without an initial failure
  // marker makes a later update error look like a successful notification.
  const rows = []
  __testing.setServiceClient(notificationClient(rows, true))
  try {
    const result = await sendBookingNotification({ event: 'booking_confirmation', booking: { id: 12, customer_name: 'Ada', customer_phone: '91234567', starts_at: '2026-09-08T14:30:00.000Z' }, service: { name: 'Test' } })
    assert.equal(result.ok, false)
    assert.equal(result.outcomePersisted, false)
    assert.equal(result.results.supabase.reason, 'outcome_persist_failed')
    assert.equal(rows.length, 1)
    assert.deepEqual(rows[0].channel_results, {
      supabase: { ok: false, mode: 'persistence_pending', reason: 'channel_results_pending' },
    })
  } finally { __testing.setServiceClient(null) }
})
