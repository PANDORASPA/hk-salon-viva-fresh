import assert from 'node:assert/strict'
import test from 'node:test'

import { bookingDatabase } from './helpers/booking-database.mjs'

test('service role atomically claims one reminder per booking, event, and configured window', async t => {
  // Mutation caught: a read-before-send reminder implementation lets two
  // concurrent cron invocations both send the same reminder.
  const db = await bookingDatabase(t)
  await db.exec('set role service_role')
  const bookingId = (await db.query(`
    insert into public.appointments (service_id, staff_id, customer_name, customer_phone, customer_email, starts_at, ends_at)
    values (1, 1, 'Guest', '91234567', 'guest@example.test', now() + interval '3 days', now() + interval '3 days 1 hour')
    returning id
  `)).rows[0].id

  const first = await db.query(
    "select * from public.claim_reminder_notification($1, 'reminder', 24, 'Guest', 'guest@example.test', now(), 'subject', 'body')", [bookingId],
  )
  const retry = await db.query(
    "select * from public.claim_reminder_notification($1, 'reminder', 24, 'Guest', 'guest@example.test', now(), 'subject', 'body')", [bookingId],
  )
  const anotherWindow = await db.query(
    "select * from public.claim_reminder_notification($1, 'reminder', 48, 'Guest', 'guest@example.test', now(), 'subject', 'body')", [bookingId],
  )

  assert.equal(first.rows[0].claimed, true)
  assert.equal(retry.rows[0].claimed, false)
  assert.equal(anotherWindow.rows[0].claimed, true)
  assert.equal((await db.query("select count(*)::int as count from public.notifications where booking_id=$1 and event='reminder'", [bookingId])).rows[0].count, 2)
})
