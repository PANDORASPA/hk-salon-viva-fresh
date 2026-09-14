import assert from 'node:assert/strict'
import test from 'node:test'

import { bookingDatabase } from './helpers/booking-database.mjs'

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
