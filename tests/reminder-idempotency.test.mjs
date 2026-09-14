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

test('simultaneous active claims have one winner and preserve a visible pending state', async t => {
  const db = await bookingDatabase(t)
  await db.exec('set role service_role')
  const bookingId = (await db.query("insert into public.appointments(service_id,staff_id,customer_name,customer_phone,customer_email,starts_at,ends_at) values(1,1,'Concurrent','93456789','concurrent@example.test',now()+interval '5 days',now()+interval '5 days 1 hour') returning id")).rows[0].id
  const sql = "select * from public.claim_reminder_notification($1, 'reminder', 24, 'Concurrent', 'concurrent@example.test', now(), 'subject', 'body')"
  const [left, right] = await Promise.all([db.query(sql, [bookingId]), db.query(sql, [bookingId])])
  const claims = [left.rows[0], right.rows[0]]
  assert.equal(claims.filter(claim => claim.claimed).length, 1)
  const pending = (await db.query("select channel_results->'email' as email, reminder_lease_expires_at from public.notifications where booking_id=$1 and event='reminder'", [bookingId])).rows[0]
  assert.equal(pending.email.status, 'persistence_pending')
  assert.equal(pending.email.reason, 'delivery_pending')
  assert.ok(pending.reminder_lease_expires_at)
})

test('failed and stale reminder claims are retryable, but a sent reminder remains final', async t => {
  const db = await bookingDatabase(t)
  await db.exec('set role service_role')
  const bookingId = (await db.query("insert into public.appointments(service_id,staff_id,customer_name,customer_phone,customer_email,starts_at,ends_at) values(1,1,'Retry','91234567','retry@example.test',now()+interval '3 days',now()+interval '3 days 1 hour') returning id")).rows[0].id
  const claim = async () => (await db.query("select * from public.claim_reminder_notification($1, 'reminder', 24, 'Retry', 'retry@example.test', now(), 'subject', 'body')", [bookingId])).rows[0]
  const first = await claim()
  await db.query("select * from public.finalize_reminder_notification($1, $2, '{\"email\":{\"ok\":false,\"status\":\"failed\",\"reason\":\"provider_error\"}}'::jsonb)", [first.notification_id, first.claim_token])
  const retry = await claim()
  assert.equal(retry.claimed, true)
  await db.query("select * from public.finalize_reminder_notification($1, $2, '{\"email\":{\"ok\":true,\"status\":\"sent\",\"id\":\"provider-1\"}}'::jsonb)", [retry.notification_id, retry.claim_token])
  assert.equal((await claim()).claimed, false)

  const staleBooking = (await db.query("insert into public.appointments(service_id,staff_id,customer_name,customer_phone,customer_email,starts_at,ends_at) values(1,1,'Stale','92345678','stale@example.test',now()+interval '4 days',now()+interval '4 days 1 hour') returning id")).rows[0].id
  const staleFirst = (await db.query("select * from public.claim_reminder_notification($1, 'reminder', 24, 'Stale', 'stale@example.test', now(), 'subject', 'body')", [staleBooking])).rows[0]
  await db.query('update public.notifications set reminder_lease_expires_at=now()-interval \'1 minute\' where id=$1', [staleFirst.notification_id])
  const staleRetry = (await db.query("select * from public.claim_reminder_notification($1, 'reminder', 24, 'Stale', 'stale@example.test', now(), 'subject', 'body')", [staleBooking])).rows[0]
  assert.equal(staleRetry.claimed, true)
  assert.notEqual(staleRetry.claim_token, staleFirst.claim_token)
})
