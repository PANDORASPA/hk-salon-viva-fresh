import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

export const ownerId = '00000000-0000-0000-0000-000000000011'
export const otherId = '00000000-0000-0000-0000-000000000012'
export const adminId = '00000000-0000-0000-0000-000000000013'
const directory = new URL('../../supabase/migrations/', import.meta.url)

// Only Supabase-owned infrastructure is stubbed. Every application migration
// is executed unmodified, in filename order, including the historical RPCs.
export async function bookingDatabase(t, { bindCustomer = true, migrationTransform = (_file, sql) => sql } = {}) {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } })
  t.after(() => db.close())
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
  `)
  const files = (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()
  for (const file of files) {
    try { await db.exec(migrationTransform(file, await readFile(new URL(file, directory), 'utf8'))) }
    catch (error) { error.message = `${file}: ${error.message}`; throw error }
  }
  await db.exec(`
    insert into auth.users values ('${ownerId}'), ('${otherId}'), ('${adminId}');
    insert into public.admin_users(user_id) values ('${adminId}');
    insert into public.services(name, duration_minutes) values ('Haircut', 60), ('Other service', 30);
    insert into public.staff(name, display_name, sort_order) values ('Staff B', 'B', 1);
    insert into public.staff_services(staff_id, service_id) values (1,1),(2,1),(1,2);
    update public.business_hours set is_open=true, opens_at='10:00', closes_at='19:00';
    update public.staff_weekly_hours set is_working=true, starts_at='10:00', ends_at='19:00';
    insert into public.staff_weekly_hours select 2, day, true, '10:00', '19:00' from generate_series(0,6) day;
    update public.app_settings set data=data || '{"booking_buffer_minutes":15,"slot_step_minutes":30,"minimum_lead_minutes":120,"maximum_advance_days":90,"cancel_cutoff_hours":24}';
    insert into public.customers(name,phone) values ('Owner', '91234567'), ('Other', '92345678');
    insert into public.packages(name,total_sessions) values ('Haircut package', 2);
    insert into public.package_services(package_id,service_id) values (1,1);
    insert into public.customer_packages(customer_id,package_id,total_sessions,sessions_remaining,expires_at)
      values (1,1,2,2,now()+interval '100 days');
  `)
  if (bindCustomer) {
    // Forward-compatible Task 6 fixture: the production identity migration will
    // supply customers.user_id. Without it the Task 5 commands fail closed.
    await db.exec(`alter table public.customers add column if not exists user_id uuid unique references auth.users(id);
      update public.customers set user_id='${ownerId}' where id=1;
      update public.customers set user_id='${otherId}' where id=2;`)
  }
  return db
}

export async function futureSlot(db, days = 3, time = '10:00') {
  return (await db.query(`select (((now() at time zone 'Asia/Hong_Kong')::date + $1::int) + $2::time)
    at time zone 'Asia/Hong_Kong' as starts_at`, [days, time])).rows[0].starts_at.toISOString()
}

export async function createSql(db, overrides = {}) {
  const input = {
    p_service_id: 1, p_starts_at: await futureSlot(db), p_staff_preference: 'any',
    p_customer_name: 'Guest Customer', p_customer_phone: '91234567', p_customer_email: null,
    p_customer_id: null, p_actor_id: null, p_customer_package_id: null, p_source: 'web',
    p_confirmation_token_hash: 'a'.repeat(64), p_customer_notes: null, ...overrides,
  }
  return callSql(db, 'create_appointment_v2', input)
}

export async function callSql(db, name, input) {
  const keys = Object.keys(input)
  return (await db.query(`select * from public.${name}(${keys.map((key, index) => `${key} => $${index + 1}`).join(',')})`, Object.values(input))).rows[0]
}

// Transport adapter: wrappers/routes execute their real production code while
// their RPC reaches the real migrated PostgreSQL functions.
export function rpcClient(db) {
  return { async rpc(name, input) {
    try { return { data: await callSql(db, name, input), error: null } }
    catch (error) { return { data: null, error } }
  } }
}
