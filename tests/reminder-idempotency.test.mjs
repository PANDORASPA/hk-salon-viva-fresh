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

test('bounded retry lookup revisits failed or expired claims at the next scheduler clock only while the appointment remains eligible', async t => {
  // Mutation caught: a retry query tied to the original one-hour window never
  // sees a 00:00 failure at the next 01:00 scheduler run.
  const db = await bookingDatabase(t)
  await db.exec('set role service_role')
  const bookingId = (await db.query("insert into public.appointments(service_id,staff_id,customer_name,customer_phone,customer_email,starts_at,ends_at) values(1,1,'Clock','94567890','clock@example.test',now()+interval '24 hours 30 minutes',now()+interval '25 hours 30 minutes') returning id")).rows[0].id
  const claimSql = "select * from public.claim_reminder_notification($1, 'reminder', 24, 'Clock', 'clock@example.test', now()+interval '24 hours 30 minutes', 'subject', 'body')"
  const first = (await db.query(claimSql, [bookingId])).rows[0]
  await db.query("select * from public.finalize_reminder_notification($1, $2, '{\"email\":{\"ok\":false,\"status\":\"failed\",\"reason\":\"provider_error\"}}'::jsonb)", [first.notification_id, first.claim_token])

  const retriedAtOne = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
  assert.deepEqual(retriedAtOne.rows.map(row => row.id), [bookingId])

  await db.query("update public.notifications set reminder_attempt=5 where id=$1", [first.notification_id])
  const capped = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
  assert.deepEqual(capped.rows, [])

  await db.query("update public.notifications set reminder_attempt=1, channel_results='{\"email\":{\"ok\":false,\"status\":\"persistence_pending\",\"reason\":\"delivery_pending\"}}'::jsonb, reminder_lease_expires_at=now()-interval '1 minute' where id=$1", [first.notification_id])
  const stale = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
  assert.deepEqual(stale.rows.map(row => row.id), [bookingId])
  await db.query("update public.appointments set status='cancelled' where id=$1", [bookingId])
  const terminal = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
  assert.deepEqual(terminal.rows, [])
  const terminalClaim = (await db.query(claimSql, [bookingId])).rows[0]
  assert.equal(terminalClaim.claimed, false)

  await db.query("update public.appointments set status='confirmed' where id=$1", [bookingId])
  for (const status of ['sent', 'disabled', 'dry_run']) {
    await db.query("update public.notifications set channel_results=jsonb_build_object('email', jsonb_build_object('ok', $2::boolean, 'status', $3::text)) where id=$1", [first.notification_id, status === 'sent', status])
    const final = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
    assert.deepEqual(final.rows, [])
  }
})
