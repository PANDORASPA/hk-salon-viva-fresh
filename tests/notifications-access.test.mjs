import assert from 'node:assert/strict'
import test from 'node:test'

import { bookingDatabase } from './helpers/booking-database.mjs'
import { createSql } from './helpers/booking-database.mjs'

test('only service_role can read and write notification rows after the full migration replay', async t => {
  // Mutation caught: removing an explicit service grant breaks the server
  // writer/dashboard, while restoring browser grants exposes private contacts.
  const db = await bookingDatabase(t, { legacyFunctionGrants: true })
  await db.exec('set role service_role')
  const inserted = await db.query("insert into public.notifications(event, customer_name, channel_results) values ('booking_confirmation', 'Service role', '{}'::jsonb) returning id")
  const id = inserted.rows[0].id
  await db.query("update public.notifications set channel_results = '{\"email\": {\"ok\": true}}'::jsonb where id=$1", [id])
  assert.equal((await db.query('select id from public.notifications where id=$1', [id])).rows[0].id, id)
  assert.ok((await db.query('select last_value from public.notifications_id_seq')).rows[0].last_value >= id)
  await assert.rejects(db.query('delete from public.notifications where id=$1', [id]), /permission denied/)
  await db.exec('reset role; set role authenticated')
  await assert.rejects(db.query('select id from public.notifications'), /permission denied/)
  await assert.rejects(db.query("insert into public.notifications(event) values ('browser_write')"), /permission denied/)
  await db.exec('reset role')
})

test('marker-gated E2E notification cleanup deletes only exact fixture bookings', async t => {
  const db = await bookingDatabase(t)
  await db.exec(`update public.app_settings set data=data || '{"e2e_marker":"isolated-marker"}'::jsonb`)
  const fixture = await createSql(db, { p_customer_name: 'e2e_booking_platform guest', p_customer_phone: '61234567' })
  const collateral = await createSql(db, { p_customer_name: 'other_namespace guest', p_customer_phone: '61234568', p_starts_at: await (await import('./helpers/booking-database.mjs')).futureSlot(db, 5) })
  await db.exec('set role service_role')
  await db.query("select set_config('request.jwt.claim.role', 'service_role', false)")
  await db.query("insert into public.notifications(event, booking_id, customer_phone) values ('fixture', $1, '61234567'), ('collateral', $2, '61234568')", [fixture.id, collateral.id])
  await db.query("select public.e2e_cleanup_notifications($1, array[$2::bigint], $3)", ['isolated-marker', fixture.id, 'e2e_booking_platform'])
  assert.equal((await db.query('select count(*)::int as count from public.notifications where booking_id=$1', [fixture.id])).rows[0].count, 0)
  assert.equal((await db.query('select count(*)::int as count from public.notifications where booking_id=$1', [collateral.id])).rows[0].count, 1)
  await assert.rejects(db.query("select public.e2e_cleanup_notifications($1, array[$2::bigint], $3)", ['wrong-marker', collateral.id, 'other_namespace']), /marker/i)
  await assert.rejects(db.query("select public.e2e_cleanup_notifications($1, array[$2::bigint], $3)", ['isolated-marker', collateral.id, 'e2e_booking_platform']), /outside the fixture namespace/i)
  assert.equal((await db.query('select count(*)::int as count from public.notifications where booking_id=$1', [collateral.id])).rows[0].count, 1)
  await db.exec('reset role; set role authenticated')
  await assert.rejects(db.query("select public.e2e_cleanup_notifications('isolated-marker', array[1::bigint], 'e2e_booking_platform')"), /permission denied/)
  await db.exec('reset role')
})
