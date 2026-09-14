import assert from 'node:assert/strict'
import test from 'node:test'
import { bookingDatabase, createSql, futureSlot, callSql, rpcClient, ownerId, adminId } from './helpers/booking-database.mjs'
import { mergeSettings } from '../lib/settings/app-settings.js'
import { scanText } from '../scripts/security-scan.mjs'
import { createStaffHoursController } from '../app/admin/components/staff-hours-controller.js'
import { createBookingCalendarController } from '../app/admin/components/booking-calendar-controller.js'
import { isStripeConfigured, createCheckoutSession } from '../lib/payments/stripe.js'
import { buildStaffAvailability } from '../lib/booking/availability-v2.js'

const request = (method, body) => new Request('http://localhost/api/test', { method, headers: { origin: 'http://localhost', 'content-type': 'application/json', 'x-real-ip': 'final-integration' }, body: body == null ? undefined : JSON.stringify(body) })
const manage = async (db, kind, id, data) => (await callSql(db, 'admin_manage_record', { p_actor_id: adminId, p_kind: kind, p_id: id, p_data: JSON.stringify(data) })).admin_manage_record

test('browser owner and browser admin cannot directly mutate or read private appointment columns', async t => {
  const db = await bookingDatabase(t)
  const row = await createSql(db, { p_customer_id: 1, p_actor_id: ownerId, p_source: 'account' })
  for (const actor of [ownerId, adminId]) {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor])
    await db.exec('set role authenticated')
    try {
      for (const sql of [`update public.appointments set status='cancelled' where id=${row.id}`, `delete from public.appointments where id=${row.id}`]) await assert.rejects(db.query(sql), e => e.code === '42501')
      for (const sql of ["update public.business_hours set is_open=false", "delete from public.blocked_dates", "update public.gallery_images set published=false", "delete from public.package_usage_logs"]) await assert.rejects(db.query(sql), e => e.code === '42501')
      await assert.rejects(db.query("select public.admin_manage_record($1,'customer',null,'{}')", [actor]), e => e.code === '42501')
      for (const field of ['admin_notes', 'confirmation_token_hash', 'cancelled_by', 'source', 'customer_id']) await assert.rejects(db.query(`select ${field} from public.appointments`), e => e.code === '42501')
      const own = await db.query('select id,reference,starts_at,status,customer_name from public.appointments')
      assert.equal(own.rows.length, actor === ownerId ? 1 : 0)
    } finally { await db.exec('reset role') }
  }
})

test('owner confirmation can read only its safe redemption timestamps through browser RLS', async t => {
  const db = await bookingDatabase(t)
  const row = await createSql(db, { p_customer_id: 1, p_actor_id: ownerId, p_customer_package_id: 1, p_source: 'account' })
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ownerId])
  await db.exec('set role authenticated')
  const own = await db.query('select redeemed_at,refunded_at from public.package_redemptions where appointment_id=$1', [row.id])
  assert.equal(own.rows.length, 1)
  assert.equal(own.rows[0].refunded_at, null)
  await assert.rejects(db.query('select customer_package_id from public.package_redemptions'), error => error.code === '42501')
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [adminId])
  await db.exec('set role authenticated')
  assert.equal((await db.query('select redeemed_at,refunded_at from public.package_redemptions')).rows.length, 0)
  await db.exec('reset role')
})

test('admin settings and full contact input reject invalid values instead of silently publishing defaults', async () => {
  const settings = await import('../lib/settings/app-settings.js')
  assert.equal(typeof settings.validateSettings, 'function')
  assert.throws(() => settings.validateSettings({ booking_buffer_minutes: 121 }))
  assert.throws(() => settings.validateSettings({ notify_dry_run: 'false' }))
  assert.throws(() => settings.validateSettings({ unknown_flag: true }))
  assert.equal(settings.validateSettings({ booking_buffer_minutes: 120 }).booking_buffer_minutes, 120)
  const content = await import('../lib/content/public-contact.js')
  assert.equal(typeof content.validateManagedContent, 'function')
  assert.throws(() => content.validateManagedContent({ contact: { phone: 'call me' } }))
  assert.throws(() => content.validateManagedContent({ contact: { instagram: 'javascript:alert(1)' } }))
  assert.throws(() => content.validateManagedContent({ contact: { email: 'not-email' } }))
  assert.throws(() => content.validateManagedContent({ contact: { internalToken: 'no' } }))
  const contact = { phone: '+852 9123 4567', email: 'admin@example.test', whatsapp: '+852 9123 4567', instagram: 'https://www.instagram.com/salon/', address: '香港工作室', addressNote: '預約後到店' }
  assert.deepEqual(content.validateManagedContent({ contact }).contact, contact)
})

test('account PATCH and DELETE refuse an admin who does not own the booking before executing RPC', async () => {
  const { createAccountBookingHandlers } = await import('../app/api/account/bookings/[id]/route.js')
  let calls = 0
  const database = { from: () => ({ select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: null, error: null }) }), rpc: async () => { calls++; return { data: { id: 1 }, error: null } } }
  const handlers = createAccountBookingHandlers({ getServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: adminId } } }) } }), getServiceClient: () => database, notify: async () => {} })
  for (const method of ['PATCH', 'DELETE']) assert.equal((await handlers[method](request(method, method === 'PATCH' ? { startsAt: '2026-10-01T10:00:00+08:00' } : undefined), { params: Promise.resolve({ id: '1' }) })).status, 404)
  assert.equal(calls, 0)
})

test('service role can operate hours, closures, gallery and perform exact E2E cleanup after complete replay', async t => {
  const db = await bookingDatabase(t)
  const row = await createSql(db)
  await db.exec('set role service_role')
  await db.exec("update public.business_hours set is_open=false,opens_at=null,closes_at=null where weekday=0")
  await db.exec('delete from public.business_hours where weekday=0; insert into public.business_hours(weekday,is_open) values(0,false)')
  await db.exec("insert into public.blocked_dates(starts_on,ends_on,reason) values ('2027-01-01','2027-01-01','休息'); update public.blocked_dates set reason='假期'; delete from public.blocked_dates")
  await db.exec("insert into public.gallery_images(storage_path,alt_text) values ('local/probe.jpg','Probe'); update public.gallery_images set caption='Updated'; select * from public.gallery_images; delete from public.gallery_images where storage_path='local/probe.jpg'")
  await db.query('delete from public.appointments where id=$1', [row.id])
  await db.exec('reset role')
})

test('out-of-range legacy buffer normalizes to SQL default and offered slots remain bookable', async t => {
  assert.equal(mergeSettings({ booking_buffer_minutes: 240 }).booking_buffer_minutes, 15)
  assert.equal(mergeSettings({ booking_buffer_minutes: 120 }).booking_buffer_minutes, 120)
  const db = await bookingDatabase(t, { migrationTransform: (file, sql) => file.includes('final_release_integrity')
    ? "update public.app_settings set data=data || '{\"booking_buffer_minutes\":240}';\n" + sql + "\ndo $$ begin if (select data->>'booking_buffer_minutes' from public.app_settings where id=1)<>'15' then raise exception 'legacy_buffer_not_normalized'; end if; end $$;"
    : sql })
  // Verify migration normalization before fixture setup, then reject invalid writes.
  await assert.rejects(callSql(db, 'admin_save_settings', { p_actor_id: adminId, p_data: JSON.stringify({ booking_buffer_minutes: 121 }) }), /invalid_settings/)
  for (const buffer of [15,120]) {
    await db.query("update public.app_settings set data=jsonb_set(data,'{booking_buffer_minutes}',$1::jsonb)", [JSON.stringify(buffer)])
    const startsAt=await futureSlot(db,buffer===15?3:4)
    const date=new Date(startsAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Hong_Kong'})
    const weekday=new Date(date).getUTCDay()
    const matrix=buildStaffAvailability({date,service:{id:1,duration_minutes:60},staff:[{id:1,is_active:true,service_ids:[1]}],weeklyHours:[{staff_id:1,weekday,is_working:true,starts_at:'10:00',ends_at:'19:00'}],businessHours:{weekday,is_open:true,opens_at:'10:00',closes_at:'19:00'},settings:{bufferMinutes:buffer},now:new Date()})
    assert.ok(matrix.slots.some(slot=>slot.label==='10:00'))
    assert.equal((await createSql(db,{p_starts_at:matrix.slots[0].iso,p_staff_preference:'1'})).buffer_minutes,buffer)
  }
})

test('remaining admin workflows commit before/after audit atomically, enforce ownership and retry issuance once', async t => {
  const db = await bookingDatabase(t)
  await db.exec('set role service_role')
  const customer = await manage(db, 'customer', null, { name: '新客戶', phone: '93456789', email: 'new@example.test', notes: '備註' })
  assert.equal(customer.name, '新客戶')
  const edited = await manage(db, 'customer', 1, { name: '更新姓名', phone: '91234567', email: 'updated@example.test', notes: '偏好' })
  assert.equal(edited.name, '更新姓名')
  const issue = { customerId: 1, packageId: 1, reason: '店內已付款', requestKey: 'aaaaaaaa-1111-4111-8111-111111111111' }
  const issued = await manage(db, 'issue_package', null, issue)
  assert.equal(issued.customer_id, 1)
  assert.equal((await manage(db, 'issue_package', null, issue)).id, issued.id)
  await assert.rejects(manage(db, 'issue_package', null, { ...issue, customerId: customer.id }), /ownership|idempotency/)
  const deactivated = await manage(db, 'customer_package', issued.id, { isActive: false, reason: '退款停用' })
  assert.equal(deactivated.is_active, false)
  assert.equal((await manage(db, 'package_state', 1, { isActive: false })).is_active, false)
  const closure = await manage(db, 'closure', null, { startsOn: '2027-01-01', endsOn: '2027-01-02', reason: '假期' })
  assert.equal(closure.reason, '假期')
  await manage(db, 'closure_delete', closure.id, {})
  const hours = Array.from({ length: 7 }, (_, weekday) => ({ weekday, is_open: false, opens_at: null, closes_at: null }))
  await manage(db, 'schedule_hours', null, { hours })
  assert.equal((await db.query('select count(*)::int n from public.business_hours where is_open')).rows[0].n, 0)
  const image = await manage(db, 'gallery_create', null, { storagePath: 'local/test.jpg', altText: '圖像', caption: '', published: true, sortOrder: 0 })
  await manage(db, 'gallery_update', image.id, { altText: '新圖像', caption: '', published: false, sortOrder: 1 })
  await manage(db, 'gallery_delete', image.id, {})
  const audits = (await db.query("select * from public.admin_audit_logs where action='issue_package' ")).rows
  assert.equal(audits.length, 1)
  assert.equal(audits[0].after_data.customer_id, 1)
  await db.exec('reset role')
  await db.exec("create function public.reject_final_audit() returns trigger language plpgsql as $$ begin raise exception 'audit_unavailable'; end $$; create trigger reject_final_audit before insert on public.admin_audit_logs for each row execute function public.reject_final_audit()")
  await db.exec('set role service_role')
  await assert.rejects(manage(db, 'customer', 1, { name: '不能儲存', phone: '91234567', email: null, notes: '' }), /audit_unavailable/)
  assert.equal((await db.query('select name from public.customers where id=1')).rows[0].name, '更新姓名')
  await db.exec('reset role')
})

test('staff hours ignore edits during an in-flight save; completion describes the saved draft', async () => {
  let finish
  const hours = Array.from({ length: 7 }, (_, weekday) => ({ weekday, isWorking: true, startsAt: '10:00', endsAt: '19:00' }))
  const controller = createStaffHoursController({ fetchImpl: async (_url, init) => init?.method ? new Promise(resolve => { finish = resolve }) : Response.json({ hours }) })
  await controller.load(1)
  const pending = controller.save(1)
  controller.update(1, { startsAt: '12:00' })
  assert.equal(controller.getState().hours[1].startsAt, '10:00')
  finish(Response.json({ hours })); await pending
  assert.ok(controller.getState().message)
})

test('calendar locks mutation reentry until completion then allows another action', async () => {
  let calls = 0; let finish
  const controller = createBookingCalendarController({ fetchImpl: () => { calls++; return new Promise(resolve => { finish = resolve }) } })
  const first = controller.mutate('POST', { customerName: '客人' })
  const second = controller.mutate('POST', { customerName: '客人' })
  assert.equal(calls, 1)
  finish(Response.json({ booking: { id: 1 } })); await Promise.all([first, second])
  const third = controller.mutate('PATCH', { id: 1, status: 'confirmed' })
  assert.equal(calls, 2)
  finish(Response.json({ booking: { id: 1 } })); await third
})

test('scanner distinguishes independent newline statements from expression continuations', () => {
  const prefix = 'const STRIPE_SECRET_KEY = "live_sensitive_value"'
  for (const next of ['\nconsole.log("x")', '\nprocess.exit(1)', '\nglobalThis.done = true']) assert.equal(scanText('probe.js', prefix + next).length, 1)
  for (const next of ['\n.trim()', '\n[0]', '\n("value")', '\n+ process.env.SUFFIX', '\n?.trim()']) assert.equal(scanText('probe.js', prefix + next).length, 0)
})

test('Stripe stays disabled with all credentials present until fulfillment is implemented', async t => {
  const keys = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']
  const before = keys.map(key => process.env[key]); t.after(() => keys.forEach((key, i) => { if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i] }))
  keys.forEach(key => { process.env[key] = 'configured-test-value' })
  assert.equal(isStripeConfigured(), false)
  await assert.rejects(createCheckoutSession({ package: { id: 1 } }), /尚未啟用/)
})

test('profile save updates canonical customer, prefills wizard, and reviewed contacts become a booking snapshot', async t => {
  const http = await import('../lib/customers/http.js')
  assert.equal(typeof http.createCustomerProfileHandler, 'function')
  const { createAppointmentsHandler } = await import('../app/api/appointments/route.js')
  const { loadCustomerPackages } = await import('../app/booking/components/booking-data.js')
  const db = await bookingDatabase(t)
  const database = rpcClient(db)
  const server = async () => ({ auth: { getUser: async () => ({ data: { user: { id: ownerId } } }) } })
  const profile = http.createCustomerProfileHandler({ getServerClient: server, getServiceClient: () => database })
  const response = await profile(request('PATCH', { name: '新姓名', phone: '95678901', email: 'changed@example.test' }))
  assert.equal(response.status, 200)
  const canonical = (await db.query('select * from public.customers where user_id=$1', [ownerId])).rows[0]
  assert.equal(canonical.phone, '95678901')
  const loaded = await loadCustomerPackages(async () => Response.json({ customer: { ...canonical, customer_packages: [] } }))
  assert.deepEqual(loaded.contact, { name: '新姓名', phone: '95678901', email: 'changed@example.test' })
  const create = createAppointmentsHandler({ getServiceClient: () => database, resolveCustomer: async () => ({ customer: canonical, actorUserId: ownerId }), notify: async () => {} })
  const made = await create(request('POST', { serviceId: 1, startsAt: await futureSlot(db), customerName: '覆核姓名', customerPhone: '96789012', customerEmail: 'reviewed@example.test', customerId: 2 }))
  assert.equal(made.status, 201)
  const booking = (await db.query('select * from public.appointments')).rows[0]
  assert.equal(booking.customer_phone, '96789012'); assert.equal(booking.customer_email, 'reviewed@example.test'); assert.equal(booking.customer_id, 1)
  assert.equal((await db.query('select phone from public.customers where id=1')).rows[0].phone, '95678901')
})

test('package choices exclude wrong services and appointments after expiry', async () => {
  const data = await import('../app/booking/components/booking-data.js')
  assert.equal(typeof data.filterCustomerPackages, 'function')
  const pack = { id: 1, is_active: true, sessions_remaining: 1, expires_at: '2026-10-03T00:00:00Z', packages: { is_active: true, package_services: [{ service_id: 1 }] } }
  assert.deepEqual(data.filterCustomerPackages([pack], 1, '2026-10-01T10:00:00+08:00'), [pack])
  assert.deepEqual(data.filterCustomerPackages([pack], 2, '2026-10-01T10:00:00+08:00'), [])
  assert.deepEqual(data.filterCustomerPackages([pack], 1, '2026-10-04T10:00:00+08:00'), [])
})

test('wizard profile prefill respects contact edits made while the profile request was pending', async () => {
  const { bookingReducer, initialBookingState } = await import('../app/booking/components/booking-reducer.js')
  const contact={name:'已儲存姓名',phone:'91234567',email:'member@example.test'}
  const filled=bookingReducer(initialBookingState,{type:'PREFILL_CONTACT',contact})
  assert.equal(filled.contact.phone,'91234567')
  const edited=bookingReducer(initialBookingState,{type:'SET_CONTACT',contact:{name:'自己輸入'}})
  assert.equal(bookingReducer(edited,{type:'PREFILL_CONTACT',contact}).contact.name,'自己輸入')
})

test('confirmation payment summary shows redeemed package without cash instructions and strips internal fields', async () => {
  const mod = await import('../lib/booking/confirmation.js')
  assert.equal(typeof mod.confirmationPayment, 'function')
  const row = { id: 1, starts_at: '2026-10-01T10:00:00+08:00', status: 'confirmed', services: { price: 68000 }, package_redemptions: [{ redeemed_at: '2026-09-14T01:00:00Z', refunded_at: null }] }
  assert.deepEqual(mod.confirmationPayment(row), { method: 'package', label: '已扣除套票 1 次' })
  assert.equal(mod.confirmationPayment({ ...row, package_redemptions: [] }).label, '現場付款')
  const result = await mod.loadConfirmationAppointment({ id: '1', user: { id: ownerId }, serverDatabase: { from() { return { select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: { ...row, admin_notes: 'secret', confirmation_token_hash: 'secret' } }) } } } })
  assert.equal(result.admin_notes, undefined); assert.equal(result.confirmation_token_hash, undefined)
  assert.equal(result.package_redemptions.length, 1)
})

test('strict admin command validators reject spoofed identity, string booleans and invalid closure dates', async () => {
  const commands = await import('../lib/admin/salon-api.js')
  assert.equal(typeof commands.validateAdminRecord, 'function')
  for (const [kind, data] of [['customer', { name: '客戶', user_id: ownerId }], ['package_state', { isActive: 'false' }], ['closure', { startsOn: '2027-02-30', endsOn: '2027-03-01', reason: '' }]]) assert.throws(() => commands.validateAdminRecord(kind, data))
})

test('every final admin command rolls back its mutation if the audit insert fails', async t => {
  const db=await bookingDatabase(t)
  const image=await manage(db,'gallery_create',null,{storagePath:'local/rollback.jpg',altText:'圖',caption:'',published:true,sortOrder:0})
  const closure=await manage(db,'closure',null,{startsOn:'2027-01-01',endsOn:'2027-01-01',reason:'休息'})
  await db.exec("create function public.fail_all_audit() returns trigger language plpgsql as $$ begin raise exception 'audit_failed'; end $$; create trigger fail_all_audit before insert on public.admin_audit_logs for each row execute function public.fail_all_audit()")
  const snapshot=async()=>JSON.stringify((await db.query("select (select jsonb_agg(c order by id) from public.customers c) customers,(select jsonb_agg(p order by id) from public.packages p) packages,(select jsonb_agg(cp order by id) from public.customer_packages cp) entitlements,(select jsonb_agg(i) from public.admin_package_issuances i) issuances,(select jsonb_agg(b order by id) from public.blocked_dates b) closures,(select jsonb_agg(h order by weekday) from public.business_hours h) hours,(select jsonb_agg(g order by id) from public.gallery_images g) gallery")).rows)
  const before=await snapshot()
  await db.exec('set role service_role')
  for(const [kind,id,data] of [
    ['customer',null,{name:'測試客戶',phone:'99887766',email:null,notes:''}],
    ['issue_package',null,{customerId:1,packageId:1,reason:'失敗派發',requestKey:'bbbbbbbb-2222-4222-8222-222222222222'}],
    ['customer_package',1,{isActive:false,reason:'退款'}],['package_state',1,{isActive:false}],
    ['closure',null,{startsOn:'2027-02-01',endsOn:'2027-02-01',reason:'休息'}],['closure_delete',closure.id,{}],
    ['schedule_hours',null,{hours:Array.from({length:7},(_,weekday)=>({weekday,is_open:false,opens_at:null,closes_at:null}))}],
    ['gallery_create',null,{storagePath:'local/new.jpg',altText:'圖',caption:'',published:true,sortOrder:0}],
    ['gallery_update',image.id,{altText:'新圖',caption:'',published:false,sortOrder:1}],['gallery_delete',image.id,{}],
  ]) {await assert.rejects(manage(db,kind,id,data),/audit_failed/);assert.equal(await snapshot(),before)}
  await db.exec('reset role')
})

test('admin route command refuses malformed input and guard rejection without database mutation', async t => {
  const db=await bookingDatabase(t)
  const {createRecordMutation}=await import('../lib/admin/salon-api.js')
  const options={kind:'customer',key:'customer',adminContext:async()=>({db:rpcClient(db),auth:{user:{id:adminId}}})}
  const denied=createRecordMutation({...options,guardMutationRequest:async()=>new Response(null,{status:403})})
  assert.equal((await denied(request('POST',{name:'客戶'}))).status,403)
  const handler=createRecordMutation({...options,guardMutationRequest:async()=>null})
  assert.equal((await handler(request('POST',{name:'客戶',user_id:ownerId}))).status,400)
  assert.equal((await handler(request('POST',{name:'新客戶',phone:'99887766',email:'new@example.test',notes:''}))).status,200)
  assert.equal((await db.query("select count(*)::int n from public.admin_audit_logs where action='customer'")).rows[0].n,1)
})

test('schedule route accepts UI closures and emergency closure of all seven weekdays via audited RPC', async t => {
  const db = await bookingDatabase(t)
  const { createAdminScheduleHandlers } = await import('../app/api/admin/schedule/route.js')
  assert.equal(typeof createAdminScheduleHandlers, 'function')
  const handlers = createAdminScheduleHandlers({ adminContext: async () => ({ db: rpcClient(db), auth: { user: { id: adminId } } }), guardMutationRequest: async () => null })
  const closure = await handlers.POST(request('POST', { type: 'closure', startsOn: '2027-01-01', endsOn: '2027-01-02', reason: '假期' }))
  assert.equal(closure.status, 201)
  const result = await closure.json()
  const remove = await handlers.DELETE(new Request('http://localhost/api/admin/schedule?id=' + result.blockedDate.id, { method: 'DELETE' }))
  assert.equal(remove.status, 200)
  const shut = await handlers.POST(request('POST', { type: 'hours', hours: Array.from({ length: 7 }, (_, weekday) => ({ weekday, is_open: false, opens_at: null, closes_at: null })) }))
  assert.equal(shut.status, 200)
  await assert.rejects(createSql(db), /closed|unavailable/i)
})

test('notification follow-up presents safe channel, outcome and actionable guidance', async () => {
  const { __testing } = await import('../app/api/admin/operations/route.js')
  assert.equal(typeof __testing.notificationView, 'function')
  const row=__testing.notificationView({id:1,event:'booking_cancellation',booking_id:2,channel_results:{
    email:{ok:false,status:'failed',reason:'no_recipient'},
    supabase:{ok:false,mode:'persistence_pending',reason:'channel_results_pending'},
    console:{ok:false,status:'disabled'},
    whatsapp:{ok:false,status:'failed',reason:'provider leaked value that must not appear'},
  }})
  assert.equal(row.eventLabel,'取消通知')
  assert.equal(row.followUp.length,3)
  assert.match(row.followUp[0].message,/聯絡電郵/)
  assert.match(row.followUp[1].message,/重複/)
  assert.doesNotMatch(JSON.stringify(row),/leaked/)
})

test('repeating a completed account cancellation does not request another notification', async t => {
  const db=await bookingDatabase(t)
  const row=await createSql(db,{p_customer_id:1,p_actor_id:ownerId,p_source:'account'})
  let sends=0
  const {createAccountBookingHandlers}=await import('../app/api/account/bookings/[id]/route.js')
  const handlers=createAccountBookingHandlers({getServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:ownerId}}})}}),getServiceClient:()=>rpcClient(db),notify:async()=>{sends++}})
  for(let i=0;i<2;i++)assert.equal((await handlers.DELETE(request('DELETE'),{params:Promise.resolve({id:String(row.id)})})).status,200)
  assert.equal(sends,1)
})

test('retired destructive and import routes are guarded, admin-only and perform no mutation', async () => {
  const {createRetiredAdminMutation}=await import('../lib/admin/salon-api.js')
  assert.equal(typeof createRetiredAdminMutation,'function')
  let checks=0
  const context=async()=>{checks++;return{db:new Proxy({},{get(){throw new Error('Retired operation must not mutate')}})}}
  const denied=createRetiredAdminMutation({guardMutationRequest:async()=>new Response(null,{status:403}),adminContext:context})
  assert.equal((await denied(request('DELETE'))).status,403)
  assert.equal(checks,0)
  const nonAdmin=createRetiredAdminMutation({guardMutationRequest:async()=>null,adminContext:async()=>({response:new Response(null,{status:401})})})
  assert.equal((await nonAdmin(request('POST',{}))).status,401)
  const retired=createRetiredAdminMutation({guardMutationRequest:async()=>null,adminContext:context})
  assert.equal((await retired(request('POST',{}))).status,410)
  assert.equal(checks,1)
})

test('settings audit preserves server-only E2E recovery metadata that the admin form cannot edit', async t => {
  const db=await bookingDatabase(t)
  await db.exec("update public.app_settings set data=data || '{\"e2e_marker\":\"isolated-only\"}'")
  await callSql(db,'admin_save_settings',{p_actor_id:adminId,p_data:JSON.stringify({booking_buffer_minutes:120})})
  assert.equal((await db.query("select data->>'e2e_marker' marker from public.app_settings")).rows[0].marker,'isolated-only')
})
