import assert from 'node:assert/strict'
import test from 'node:test'
import { access } from 'node:fs/promises'
import { bookingDatabase, ownerId, otherId, adminId, futureSlot } from './helpers/booking-database.mjs'
import { customerClient, authClient } from './helpers/customer-client.mjs'

async function identity() {
  assert.equal(await access(new URL('../lib/customers/identity.js', import.meta.url)).then(() => true, () => false), true, 'auth-bound resolver must exist')
  return import('../lib/customers/identity.js')
}

test('PostgreSQL denies anonymous customer/package reads and limits owners to their own rows', async t => {
  const db = await bookingDatabase(t)
  await db.exec(`insert into public.customer_packages(customer_id,package_id,total_sessions,sessions_remaining,expires_at) values(2,1,2,2,now()+interval '10 days')`)
  await db.exec('set role anon')
  for (const table of ['customers','customer_packages']) await assert.rejects(db.query(`select * from public.${table}`), e => e.code === '42501')
  await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${ownerId}'`)
  assert.deepEqual((await db.query('select id from public.customers')).rows, [{id:1}])
  assert.deepEqual((await db.query('select id from public.customer_packages')).rows, [{id:1}])
  assert.equal((await db.query("update public.customers set name='Changed' where id=2 returning id")).rows.length, 0)
  assert.deepEqual((await db.query("update public.customers set name='Owner changed' where id=1 returning id")).rows, [{id:1}])
  await assert.rejects(db.exec(`update public.customers set user_id='${adminId}' where id=1`), e => e.code === '42501')
  await assert.rejects(db.exec('update public.customers set user_id=null where id=1'), e => e.code === '42501')
  await assert.rejects(db.exec("insert into public.customers(name,phone) values('Imposter','93456789')"), e => e.code === '42501')
  await assert.rejects(db.query('update public.customer_packages set sessions_remaining=999 returning id'), e => e.code === '42501')
  await db.exec('reset role')
  await assert.rejects(db.exec(`insert into public.customers(name,phone,user_id) values('Duplicate','93456789','${ownerId}')`), e => e.code === '23505')
  await assert.rejects(db.exec("insert into public.customers(name,phone,user_id) values('Unknown','93456789','00000000-0000-0000-0000-000000000099')"), e => e.code === '23503')
})

test('resolver verifies auth and ignores metadata identities, phone matches and authentication errors', async t => {
  const { resolveAuthenticatedCustomer } = await identity()
  const db = await bookingDatabase(t)
  const client = customerClient(db)
  const user = {id:ownerId, phone:'92345678', phone_confirmed_at:'2026-01-01', user_metadata:{customerId:2,user_id:otherId}}
  assert.equal((await resolveAuthenticatedCustomer(authClient(user), client)).id, 1)
  for (const auth of [authClient(null), authClient(user,{message:'invalid token'}), authClient({...user,is_anonymous:true})]) {
    assert.equal(await resolveAuthenticatedCustomer(auth, client), null)
  }
})

test('ownership RLS independently rejects binding changes and claiming unlinked legacy rows', async t => {
  const db = await bookingDatabase(t)
  await db.exec(`insert into public.customers(name,phone) values('Legacy','93456789');
    insert into public.customer_packages(customer_id,package_id,total_sessions,sessions_remaining,expires_at)
      values(3,1,2,2,now()+interval '10 days');
    grant update(user_id) on public.customers to authenticated;
    set role authenticated; set request.jwt.claim.sub='${ownerId}';`)
  // Temporarily widening this test's column grant proves the row policy itself
  // still rejects reassignment, independently of production column protection.
  await assert.rejects(db.exec(`update public.customers set user_id='${adminId}' where id=1`), e => e.code === '42501')
  await assert.rejects(db.exec('update public.customers set user_id=null where id=1'), e => e.code === '42501')
  assert.deepEqual((await db.query(`update public.customers set user_id='${ownerId}' where id=3 returning id`)).rows,[])
  assert.deepEqual((await db.query('select id from public.customer_packages')).rows,[{id:1}])
  await db.exec(`set request.jwt.claim.sub='${adminId}'`)
  assert.deepEqual((await db.query('select id from public.customers')).rows,[])
  await db.exec('reset role')
  assert.equal((await db.query('select user_id from public.customers where id=3')).rows[0].user_id,null)
})

test('first auth access is idempotent and never claims legacy rows sharing verified email or phone', async t => {
  const { resolveAuthenticatedCustomer } = await identity()
  const db = await bookingDatabase(t,{bindCustomer:false})
  await db.exec("update public.customers set email='owner@example.com' where id=1; set role service_role")
  const client = customerClient(db)
  const user = {id:ownerId,email:'owner@example.com',email_confirmed_at:'2026-01-01',phone:'91234567',phone_confirmed_at:'2026-01-01',user_metadata:{full_name:'Forged',customerId:1}}
  const results = await Promise.all([resolveAuthenticatedCustomer(authClient(user),client),resolveAuthenticatedCustomer(authClient(user),client)])
  assert.equal(results[0].id,results[1].id)
  assert.notEqual(results[0].id,1)
  assert.equal(results[0].phone,null)
  assert.equal(results[0].email,'owner@example.com')
  assert.notEqual(results[0].name,'Forged')
  assert.equal((await db.query('select user_id from public.customers where id=1')).rows[0].user_id,null)
  const second = await resolveAuthenticatedCustomer(authClient({id:otherId,email:'unverified@example.com',phone:'93456789'}),client)
  assert.equal(second.email,null)
  assert.equal(second.phone,null)
})

test('/me returns only caller safe profile and usable packages; legacy phone route is decommissioned', async t => {
  await identity()
  const { createCustomerMeHandler } = await import('../lib/customers/http.js')
  const { GET: legacy } = await import('../app/api/customers/route.js')
  const db = await bookingDatabase(t)
  await db.exec(`update public.customers set notes='private staff notes' where id=1;
    insert into public.customer_packages(customer_id,package_id,total_sessions,sessions_remaining,expires_at,is_active) values
    (2,1,2,2,now()+interval '10 days',true),(1,1,2,0,now()+interval '10 days',true),
    (1,1,2,2,now()-interval '1 day',true),(1,1,2,2,now()+interval '10 days',false);`)
  const handler = user => createCustomerMeHandler({getServerClient:()=>authClient(user),getServiceClient:()=>customerClient(db)})
  const url = new Request('http://localhost/api/customers/me?phone=92345678&customerId=2')
  assert.equal((await handler(null)(url)).status,401)
  const response = await handler({id:ownerId})(url)
  assert.equal(response.status,200)
  assert.match(response.headers.get('cache-control'),/no-store/)
  const body = await response.json()
  assert.deepEqual(Object.keys(body.customer).sort(),['customer_packages','email','id','name','phone'])
  assert.equal(body.customer.id,1)
  assert.deepEqual(body.customer.customer_packages.map(p=>p.id),[1])
  assert.equal(body.customer.customer_packages[0].packages.name,'Haircut package')
  await db.exec('update public.packages set is_active=false where id=1')
  assert.deepEqual((await (await handler({id:ownerId})(url)).json()).customer.customer_packages,[])
  const gone = await legacy(new Request('http://localhost/api/customers?phone=91234567'))
  assert.equal(gone.status,410)
  assert.equal(JSON.stringify(await gone.json()).includes('Owner'),false)
  const failing = createCustomerMeHandler({getServerClient:()=>{throw new Error('private secret')},getServiceClient:()=>customerClient(db)})
  const failed = await failing(url)
  assert.equal(failed.status,500)
  assert.equal(JSON.stringify(await failed.json()).includes('private secret'),false)
})

test('appointment route uses real resolver and SQL ownership for owners, cross-owners and guests', async t => {
  await identity()
  const { createAppointmentsHandler } = await import('../app/api/appointments/route.js')
  const db = await bookingDatabase(t)
  const handler = user => createAppointmentsHandler({getServerClient:()=>authClient(user),getServiceClient:()=>customerClient(db),notify:async()=>{}})
  const body = {serviceId:1,startsAt:await futureSlot(db),customerPackageId:1,customerId:2,actorUserId:otherId,customerName:'Submitted name',customerPhone:'93456789'}
  const request = value => new Request('http://localhost/api/appointments',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify(value)})
  assert.equal((await handler(null)(request(body))).status,401)
  assert.equal((await handler({id:otherId})(request(body))).status,403)
  const owned = await handler({id:ownerId})(request(body))
  assert.equal(owned.status,201)
  assert.equal((await owned.json()).appointment.customer_id,1)
  const guest = await handler(null)(request({...body,customerPackageId:null,startsAt:await futureSlot(db,4)}))
  assert.equal(guest.status,201)
  assert.equal((await guest.json()).appointment.customer_id,null)
  assert.equal((await db.query('select sessions_remaining from public.customer_packages where id=1')).rows[0].sessions_remaining,1)
  const emailOnly = await handler({id:adminId,email:'new@example.com',email_confirmed_at:'2026-01-01'})(request({...body,customerPackageId:null,startsAt:await futureSlot(db,5)}))
  assert.equal(emailOnly.status,201)
  const newBooking = (await emailOnly.json()).appointment
  assert.equal(newBooking.user_id,adminId)
  assert.notEqual(newBooking.customer_id,2)
  assert.equal(newBooking.customer_phone,'93456789')
  const newCustomer = (await db.query('select phone,user_id from public.customers where id=$1',[newBooking.customer_id])).rows[0]
  assert.equal(newCustomer.phone,null)
  assert.equal(newCustomer.user_id,adminId)
})
