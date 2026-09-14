import assert from 'node:assert/strict'
import test from 'node:test'

import { bookingDatabase } from './helpers/booking-database.mjs'

test('service role atomically claims one reminder per booking, event, and configured window', async t => {
  // Mutation caught: a read-before-send reminder implementation lets two
  // concurrent cron invocations both send the same reminder.
  const db = await bookingDatabase(t)
  await db.exec('set role service_role')
  const booking = (await db.query(`
    insert into public.appointments (service_id, staff_id, customer_name, customer_phone, customer_email, starts_at, ends_at)
    values (1, 1, 'Guest', '91234567', 'guest@example.test', now() + interval '24 hours 30 minutes', now() + interval '25 hours 30 minutes')
    returning id, starts_at
  `)).rows[0]

  const first = await db.query(
    "select * from public.claim_reminder_notification($1, 'reminder', 24, 'Guest', 'guest@example.test', $2, 'subject', 'body')", [booking.id, booking.starts_at],
  )
  const retry = await db.query(
    "select * from public.claim_reminder_notification($1, 'reminder', 24, 'Guest', 'guest@example.test', $2, 'subject', 'body')", [booking.id, booking.starts_at],
  )
  const anotherWindow = await db.query(
    "select * from public.claim_reminder_notification($1, 'reminder', 48, 'Guest', 'guest@example.test', $2, 'subject', 'body')", [booking.id, booking.starts_at],
  )

  assert.equal(first.rows[0].claimed, true)
  assert.equal(retry.rows[0].claimed, false)
  assert.equal(anotherWindow.rows[0].claimed, false)
  assert.equal((await db.query("select count(*)::int as count from public.notifications where booking_id=$1 and event='reminder'", [booking.id])).rows[0].count, 1)
})

test('simultaneous active claims have one winner and preserve a visible pending state', async t => {
  const db = await bookingDatabase(t)
  await db.exec('set role service_role')
  const booking = (await db.query("insert into public.appointments(service_id,staff_id,customer_name,customer_phone,customer_email,starts_at,ends_at) values(1,1,'Concurrent','93456789','concurrent@example.test',now()+interval '24 hours 30 minutes',now()+interval '25 hours 30 minutes') returning id,starts_at")).rows[0]
  const sql = "select * from public.claim_reminder_notification($1, 'reminder', 24, 'Concurrent', 'concurrent@example.test', $2, 'subject', 'body')"
  const [left, right] = await Promise.all([db.query(sql, [booking.id, booking.starts_at]), db.query(sql, [booking.id, booking.starts_at])])
  const claims = [left.rows[0], right.rows[0]]
  assert.equal(claims.filter(claim => claim.claimed).length, 1)
  const pending = (await db.query("select channel_results->'email' as email, reminder_lease_expires_at from public.notifications where booking_id=$1 and event='reminder'", [booking.id])).rows[0]
  assert.equal(pending.email.status, 'persistence_pending')
  assert.equal(pending.email.reason, 'delivery_pending')
  assert.ok(pending.reminder_lease_expires_at)
})

test('known-safe failures wait for the retry horizon and sent reminders remain final', async t => {
  const db = await bookingDatabase(t)
  await db.exec('set role service_role')
  const booking = (await db.query("insert into public.appointments(service_id,staff_id,customer_name,customer_phone,customer_email,starts_at,ends_at) values(1,1,'Retry','91234567','retry@example.test',now()+interval '24 hours 30 minutes',now()+interval '25 hours 30 minutes') returning id,starts_at")).rows[0]
  const claim = async () => (await db.query("select * from public.claim_reminder_notification($1, 'reminder', 24, 'Retry', 'retry@example.test', $2, 'subject', 'body')", [booking.id, booking.starts_at])).rows[0]
  const first = await claim()
  await db.query("select * from public.finalize_reminder_notification($1, $2, '{\"email\":{\"ok\":false,\"status\":\"failed\",\"reason\":\"sender_not_configured\"}}'::jsonb)", [first.notification_id, first.claim_token])
  assert.equal((await claim()).claimed, false)
  await db.query("update public.notifications set channel_results='{\"email\":{\"ok\":true,\"status\":\"sent\",\"id\":\"provider-1\"}}'::jsonb where id=$1", [first.notification_id])
  assert.equal((await claim()).claimed, false)
})

test('bounded retry lookup revisits failed or expired claims at the next scheduler clock only while the appointment remains eligible', async t => {
  // Mutation caught: a retry query tied to the original one-hour window never
  // sees a 00:00 failure at the next 01:00 scheduler run.
  const db = await bookingDatabase(t)
  await db.exec('set role service_role')
  const booking = (await db.query("insert into public.appointments(service_id,staff_id,customer_name,customer_phone,customer_email,starts_at,ends_at) values(1,1,'Clock','94567890','clock@example.test',now()+interval '24 hours 30 minutes',now()+interval '25 hours 30 minutes') returning id,starts_at")).rows[0]
  const claimSql = "select * from public.claim_reminder_notification($1, 'reminder', 24, 'Clock', 'clock@example.test', $2, 'subject', 'body')"
  const first = (await db.query(claimSql, [booking.id, booking.starts_at])).rows[0]
  await db.query("select * from public.finalize_reminder_notification($1, $2, '{\"email\":{\"ok\":false,\"status\":\"failed\",\"reason\":\"sender_not_configured\"}}'::jsonb)", [first.notification_id, first.claim_token])

  const retriedAtOne = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
  assert.deepEqual(retriedAtOne.rows.map(row => row.id), [booking.id])

  await db.query("update public.notifications set reminder_attempt=5 where id=$1", [first.notification_id])
  const capped = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
  assert.deepEqual(capped.rows, [])

  await db.query("update public.notifications set reminder_attempt=1, channel_results='{\"email\":{\"ok\":false,\"status\":\"persistence_pending\",\"reason\":\"delivery_pending\"}}'::jsonb, reminder_lease_expires_at=now()-interval '1 minute' where id=$1", [first.notification_id])
  const stale = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
  assert.deepEqual(stale.rows.map(row => row.id), [booking.id])
  await db.query("update public.appointments set status='cancelled' where id=$1", [booking.id])
  const terminal = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
  assert.deepEqual(terminal.rows, [])
  const terminalClaim = (await db.query(claimSql, [booking.id, booking.starts_at])).rows[0]
  assert.equal(terminalClaim.claimed, false)

  await db.query("update public.appointments set status='confirmed' where id=$1", [booking.id])
  for (const status of ['sent', 'disabled', 'dry_run']) {
    await db.query("update public.notifications set channel_results=jsonb_build_object('email', jsonb_build_object('ok', $2::boolean, 'status', $3::text)) where id=$1", [first.notification_id, status === 'sent', status])
    const final = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
    assert.deepEqual(final.rows, [])
  }
})

test('claim accepts only the locked authoritative snapshot in its initial reminder window', async t => {
  // Mutation caught: a stale scheduler row can claim a rescheduled, past, or
  // differently-windowed appointment and create a reminder for the wrong time.
  const db = await bookingDatabase(t)
  await db.exec('set role service_role')
  const create = async (name, interval, staffId = 1) => (await db.query(`insert into public.appointments(service_id,staff_id,customer_name,customer_phone,customer_email,starts_at,ends_at) values(1,$4,$1,'95678901',$2 || '@example.test',now()+$3::interval,now()+$3::interval+interval '1 hour') returning id,starts_at`, [name, name.toLowerCase(), interval, staffId])).rows[0]
  const claim = async (booking, snapshot) => (await db.query("select * from public.claim_reminder_notification($1, 'reminder', 24, 'Authoritative', 'authoritative@example.test', $2, 'subject', 'body')", [booking.id, snapshot])).rows[0]

  const mismatched = await create('Mismatch', '24 hours 30 minutes')
  assert.equal((await claim(mismatched, new Date(new Date(mismatched.starts_at).getTime() + 2_000))).claimed, false)

  const rescheduled = await create('Rescheduled', '24 hours 30 minutes', 2)
  const oldSnapshot = rescheduled.starts_at
  await db.query("update public.appointments set starts_at=starts_at+interval '15 minutes', ends_at=ends_at+interval '15 minutes' where id=$1", [rescheduled.id])
  assert.equal((await claim(rescheduled, oldSnapshot)).claimed, false)

  const tooEarly = await create('Early', '22 hours')
  assert.equal((await claim(tooEarly, tooEarly.starts_at)).claimed, false)
  const tooLate = await create('Late', '27 hours')
  assert.equal((await claim(tooLate, tooLate.starts_at)).claimed, false)
  const past = await create('Past', '-1 hour')
  assert.equal((await claim(past, past.starts_at)).claimed, false)
})

test('ambiguous stale pending delivery stops automatic retries at the 24-hour provider-idempotency boundary', async t => {
  // Mutation caught: an uncertain finalization can be auto-sent after the
  // provider's 24-hour idempotency retention, risking a duplicate reminder.
  const db = await bookingDatabase(t)
  await db.exec('set role service_role')
  const booking = (await db.query("insert into public.appointments(service_id,staff_id,customer_name,customer_phone,customer_email,starts_at,ends_at) values(1,1,'Ambiguous','96789012','ambiguous@example.test',now()+interval '24 hours 30 minutes',now()+interval '25 hours 30 minutes') returning id,starts_at")).rows[0]
  const first = (await db.query("select * from public.claim_reminder_notification($1, 'reminder', 24, 'Ambiguous', 'ambiguous@example.test', $2, 'subject', 'body')", [booking.id, booking.starts_at])).rows[0]
  const failedFinalization = (await db.query("select * from public.finalize_reminder_notification($1, '00000000-0000-0000-0000-000000000000', '{\"email\":{\"ok\":true,\"status\":\"sent\"}}'::jsonb)", [first.notification_id])).rows[0]
  assert.equal(failedFinalization.finalized, false)

  await db.query("update public.notifications set delivered_at=now()-interval '22 hours 59 minutes', reminder_lease_expires_at=now()-interval '1 minute' where id=$1", [first.notification_id])
  const withinRetention = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
  assert.deepEqual(withinRetention.rows.map(row => row.id), [booking.id])

  await db.query("update public.notifications set delivered_at=now()-interval '24 hours' where id=$1", [first.notification_id])
  const beyondRetention = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
  assert.deepEqual(beyondRetention.rows, [])
  const reconciled = await db.query("select * from public.reconcile_expired_ambiguous_reminders(now()+interval '1 hour', 50)")
  assert.deepEqual(reconciled.rows.map(row => row.notification_id), [first.notification_id])
  const state = (await db.query("select channel_results->'email' as email from public.notifications where id=$1", [first.notification_id])).rows[0].email
  assert.deepEqual(state, { ok: false, status: 'reconciliation_required', reason: 'provider_delivery_unknown' })

  await db.query("update public.notifications set channel_results='{\"email\":{\"ok\":false,\"status\":\"failed\",\"reason\":\"provider_error\"}}'::jsonb where id=$1", [first.notification_id])
  const providerAmbiguous = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
  assert.deepEqual(providerAmbiguous.rows, [])
})

test('retry lookup joins the authoritative appointment instant instead of an obsolete reminder snapshot', async t => {
  const db = await bookingDatabase(t)
  await db.exec('set role service_role')
  const booking = (await db.query("insert into public.appointments(service_id,staff_id,customer_name,customer_phone,customer_email,starts_at,ends_at) values(1,1,'Moved','97890123','moved@example.test',now()+interval '24 hours 30 minutes',now()+interval '25 hours 30 minutes') returning id,starts_at")).rows[0]
  const first = (await db.query("select * from public.claim_reminder_notification($1, 'reminder', 24, 'Moved', 'moved@example.test', $2, 'subject', 'body')", [booking.id, booking.starts_at])).rows[0]
  assert.equal(first.claimed, true)
  await db.query("update public.appointments set starts_at=starts_at+interval '15 minutes', ends_at=ends_at+interval '15 minutes' where id=$1", [booking.id])
  await db.query("update public.notifications set reminder_lease_expires_at=now()-interval '1 minute' where id=$1", [first.notification_id])
  const retry = await db.query("select * from public.find_retryable_reminder_appointments(24, now()+interval '1 hour', 50)")
  assert.deepEqual(retry.rows, [])
})

test('claim rejects a legacy retry record without an authoritative start snapshot', async t => {
  const db = await bookingDatabase(t)
  await db.exec('set role service_role')
  const booking = (await db.query("insert into public.appointments(service_id,staff_id,customer_name,customer_phone,customer_email,starts_at,ends_at) values(1,1,'Legacy','98901234','legacy@example.test',now()+interval '23 hours 30 minutes',now()+interval '24 hours 30 minutes') returning id,starts_at")).rows[0]
  await db.query("insert into public.notifications(event,booking_id,customer_name,customer_email,reminder_window_hours,reminder_attempt,channel_results) values('reminder',$1,'Legacy','legacy@example.test',24,1,'{\"email\":{\"ok\":false,\"status\":\"failed\",\"reason\":\"sender_not_configured\"}}'::jsonb)", [booking.id])
  const claim = (await db.query("select * from public.claim_reminder_notification($1, 'reminder', 24, 'Legacy', 'legacy@example.test', $2, 'subject', 'body')", [booking.id, booking.starts_at])).rows[0]
  assert.equal(claim.claimed, false)
})
