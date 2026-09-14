import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const migrations = new URL('../supabase/migrations/', import.meta.url);
const files = (await readdir(migrations)).filter(file => file.endsWith('.sql')).sort();
const foundationFile = files.find(file => file.endsWith('_booking_staff_foundation.sql'));
const foundation = await readFile(new URL(foundationFile, migrations), 'utf8');
const adminId = '00000000-0000-0000-0000-000000000001';
const memberId = '00000000-0000-0000-0000-000000000002';

// Runs the actual predecessor migrations except the broken package RPC migration.
// Supabase-owned auth/storage infrastructure has a minimal fixture. Historical
// package RPC replay has unrelated return-type/order defects (see task report).
async function database(t, legacyDefaults = false) {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    create table storage.buckets (id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key, bucket_id text);
  `);
  for (const file of files.filter(file => file < foundationFile && !file.endsWith('_package_redeem_rpc.sql'))) {
    await db.exec(await readFile(new URL(file, migrations), 'utf8'));
  }
  await db.exec(`
    insert into auth.users values ('${adminId}'), ('${memberId}');
    insert into public.admin_users(user_id) values ('${adminId}');
    insert into public.services(name, enabled, published) values
      ('Enabled service', true, true), ('Disabled service', false, false),
      ('Unpublished service', true, false);
  `);
  if (legacyDefaults) await db.exec(`
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `);
  return db;
}

async function asRole(db, role, userId, action) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  await db.exec(`set role ${role}`);
  try { return await action(); } finally { await db.exec('reset role'); }
}

async function appointment(db, start, { status = 'confirmed', staffId, buffer = 15, occupied } = {}) {
  const columns = ['service_id', 'customer_name', 'customer_phone', 'starts_at', 'ends_at', 'status'];
  const values = [1, 'Test Customer', '12345678', start, new Date(new Date(start).getTime() + 3600000).toISOString(), status];
  if (staffId !== undefined) { columns.push('staff_id'); values.push(staffId); }
  if (buffer !== 15) { columns.push('buffer_minutes'); values.push(buffer); }
  if (occupied !== undefined) { columns.push('occupied_until'); values.push(occupied); }
  return (await db.query(`insert into public.appointments (${columns.join(',')})
    values (${values.map((_, index) => `$${index + 1}`).join(',')}) returning *`, values)).rows[0];
}

test('staff foundation declares staff scheduling and range collision protection', () => {
  for (const table of ['staff', 'staff_services', 'staff_weekly_hours', 'staff_time_off']) {
    assert.match(foundation, new RegExp(`create table public\\.${table}\\s*\\(`, 'i'));
  }
  assert.match(foundation, /exclude using gist/i);
  assert.match(foundation, /tstzrange\s*\(starts_at,\s*occupied_until/i);
});

test('migration backfills existing appointments and enabled service/hour mappings', async t => {
  const db = await database(t);
  const original = await appointment(db, '2026-09-15T02:00:00Z');
  await appointment(db, '2026-09-15T02:00:00Z', { status: 'cancelled' });
  await appointment(db, '2026-09-15T02:00:00Z', { status: 'no_show' });
  await db.exec(foundation);
  const staff = (await db.query('select * from public.staff')).rows;
  assert.equal(staff.length, 1);
  assert.equal(staff[0].is_active, true);
  const rows = (await db.query('select * from public.appointments order by id')).rows;
  assert.equal(rows.length, 3);
  assert.equal(rows[0].reference, original.reference);
  assert.equal(rows[0].customer_name, original.customer_name);
  assert.equal(rows[0].staff_id, staff[0].id);
  assert.equal(rows[0].buffer_minutes, 15);
  assert.equal(rows[0].occupied_until.toISOString(), '2026-09-15T03:15:00.000Z');
  assert.deepEqual((await db.query('select service_id from public.staff_services order by service_id')).rows,
    [{ service_id: 1 }, { service_id: 3 }]);
  assert.equal((await db.query(`select count(*)::int as count from public.staff_weekly_hours h
    join public.business_hours b on b.weekday=h.weekday where h.is_working=b.is_open
    and h.starts_at is not distinct from b.opens_at and h.ends_at is not distinct from b.closes_at`)).rows[0].count, 7);
});

test('overlap preflight reports conflicting pairs and rolls back without partial schema/data writes', async t => {
  const db = await database(t);
  await appointment(db, '2026-09-15T02:00:00Z');
  await appointment(db, '2026-09-15T03:00:00Z', { status: 'completed' });
  await appointment(db, '2026-09-15T02:15:00Z', { status: 'pending' });
  const before = (await db.query('select * from public.appointments order by id')).rows;
  await assert.rejects(db.exec(foundation), /booking_staff_foundation.*3.*overlap/i);
  await db.exec('rollback');
  assert.deepEqual((await db.query('select * from public.appointments order by id')).rows, before);
  assert.equal((await db.query("select to_regclass('public.staff') as table_name")).rows[0].table_name, null);
  assert.equal((await db.query("select count(*)::int as count from information_schema.columns where table_name='appointments' and column_name='staff_id'")).rows[0].count, 0);
});

test('occupancy rejects active overlap, permits adjacency/other staff, and releases cancelled/no-show slots', async t => {
  const db = await database(t);
  await db.exec(foundation);
  const first = await appointment(db, '2026-09-15T02:00:00Z');
  for (const status of ['pending', 'confirmed', 'completed']) {
    await assert.rejects(appointment(db, '2026-09-15T03:00:00Z', { status }), error => error.code === '23P01');
  }
  await appointment(db, '2026-09-15T03:15:00Z');
  await db.exec("insert into public.staff(name, display_name) values ('Other Staff', 'Other')");
  await appointment(db, '2026-09-15T02:00:00Z', { staffId: 2 });
  for (const status of ['cancelled', 'no_show']) await appointment(db, '2026-09-15T02:00:00Z', { status });
  await db.query("update public.appointments set status='cancelled' where id=$1", [first.id]);
  await appointment(db, '2026-09-15T02:00:00Z');
  await assert.rejects(db.query("update public.appointments set status='confirmed' where id=$1", [first.id]), error => error.code === '23P01');
});

test('occupancy is always derived from end plus buffer, including updates and legacy RPC inserts', async t => {
  const db = await database(t);
  await db.exec(foundation);
  const row = await appointment(db, '2026-09-15T02:00:00Z', { occupied: '2026-09-15T02:01:00Z' });
  assert.equal(row.occupied_until.toISOString(), '2026-09-15T03:15:00.000Z');
  const updated = (await db.query(`update public.appointments set ends_at='2026-09-15T04:00:00Z',
    buffer_minutes=30, occupied_until='2026-09-15T04:00:00Z' where id=$1 returning occupied_until`, [row.id])).rows[0];
  assert.equal(updated.occupied_until.toISOString(), '2026-09-15T04:30:00.000Z');
  await assert.rejects(appointment(db, '2026-09-15T04:15:00Z'), error => error.code === '23P01');
  const rpc = (await db.query(`select * from public.create_salon_appointment(1, null, 'Legacy Customer',
    '12345678', null, '2026-09-16T02:00:00Z', null)`)).rows[0];
  assert.equal(rpc.staff_id, row.staff_id);
  assert.equal(rpc.occupied_until.toISOString(), '2026-09-16T03:15:00.000Z');
  for (const buffer of [-1, 121]) await assert.rejects(appointment(db, '2026-09-17T02:00:00Z', { buffer }), error => error.code === '23514');
  await assert.rejects(appointment(db, '2026-09-17T02:00:00Z', { staffId: null }), error => error.code === '23502');
  await assert.rejects(appointment(db, '2026-09-17T02:00:00Z', { staffId: 999 }), error => error.code === '23503');
  await assert.rejects(db.query("update public.appointments set source='unknown' where id=$1", [row.id]), error => error.code === '23514');
  await assert.rejects(db.query("update public.appointments set ends_at='infinity' where id=$1", [row.id]), error => error.code === '23514');
});

for (const legacyDefaults of [false, true]) {
  test(`RLS and explicit grants protect display fields, inactive staff and time-off (legacy grants=${legacyDefaults})`, async t => {
    const db = await database(t, legacyDefaults);
    await db.exec(foundation);
    await db.exec(`
      insert into public.staff(name, display_name, is_active) values ('Private Internal Name', 'Hidden', false);
      insert into public.staff_services values (2, 1);
      insert into public.staff_weekly_hours values (2, 1, true, '10:00', '18:00');
      insert into public.staff_time_off(staff_id, starts_at, ends_at, reason, created_by)
        values (1, '2026-09-18T02:00:00Z', '2026-09-18T03:00:00Z', 'Private reason', '${adminId}');
    `);
    for (const role of ['anon', 'authenticated']) {
      await asRole(db, role, memberId, async () => {
        const rows = (await db.query('select id, display_name, bio, colour_hex, is_active, sort_order from public.staff')).rows;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].id, 1);
        await assert.rejects(db.query('select name from public.staff'), error => error.code === '42501');
        assert.equal((await db.query('select * from public.staff_weekly_hours')).rows.length, 7);
        assert.deepEqual((await db.query('select * from public.staff_services')).rows, [{ staff_id: 1, service_id: 1 }]);
        if (role === 'anon') await assert.rejects(db.query('select reason from public.staff_time_off'), error => error.code === '42501');
        else assert.deepEqual((await db.query('select reason from public.staff_time_off')).rows, []);
        for (const table of ['staff', 'staff_services', 'staff_weekly_hours', 'staff_time_off']) {
          await assert.rejects(db.query(`delete from public.${table}`), error => error.code === '42501');
        }
      });
    }
    await asRole(db, 'authenticated', adminId, async () => {
      assert.deepEqual((await db.query('select reason from public.staff_time_off')).rows, [{ reason: 'Private reason' }]);
    });
    await asRole(db, 'service_role', null, async () => {
      assert.equal((await db.query('select name from public.staff')).rows.length, 2);
      assert.equal((await db.query('select reason from public.staff_time_off')).rows.length, 1);
      await db.exec("insert into public.staff(name, display_name) values ('Server Created', 'Server')");
      await db.exec("update public.staff set name='Server Updated' where display_name='Server'");
      await db.exec("delete from public.staff where display_name='Server'");
    });
    const rls = (await db.query(`select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace
      and relname in ('staff', 'staff_services', 'staff_weekly_hours', 'staff_time_off')`)).rows;
    assert.equal(rls.length, 4);
    assert.ok(rls.every(row => row.relrowsecurity));
    await assert.rejects(db.exec("insert into public.staff_weekly_hours values (1, 7, true, '12:00', '11:00')"), error => error.code === '23514');
    await assert.rejects(db.exec("update public.staff_weekly_hours set starts_at=null where staff_id=1 and weekday=1"), error => error.code === '23514');
    await assert.rejects(db.exec("update public.staff_time_off set ends_at=starts_at"), error => error.code === '23514');
    await assert.rejects(db.exec("update public.staff set colour_hex='invalid'"), error => error.code === '23514');
    await assert.rejects(db.exec("delete from public.services where id=1"), error => error.code === '23503');
  });
}
