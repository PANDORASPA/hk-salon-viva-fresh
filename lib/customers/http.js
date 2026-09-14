import { getServerClient } from '../supabase/server.js'
import { getServiceClient } from '../supabase/service.js'
import { resolveAuthenticatedCustomer, usableCustomerPackages, publicCustomer } from './identity.js'
import { validateCustomerInput } from '../validation/customer.js'
import { guardMutationRequest } from '../security/request-guards.js'

export function createCustomerProfileHandler({ getServerClient: server = getServerClient, getServiceClient: service = getServiceClient } = {}) {
  return async function saveProfile(request) {
    const guard = await guardMutationRequest(request, { rateLimit: { scope: 'account.profile', limit: 20, windowMs: 60_000 } })
    if (guard) return guard
    const headers = { 'Cache-Control': 'private, no-store' }
    try {
      const auth = await server()
      const { data: { user } = {}, error: authError } = await auth.auth.getUser()
      if (authError || !user || user.is_anonymous) return Response.json({ error: 'authentication_required' }, { status: 401, headers })
      let value
      try { value = validateCustomerInput(await request.json()) } catch { return Response.json({ error: '請檢查姓名、電話及電郵。' }, { status: 400, headers }) }
      const db = await service()
      const customer = await resolveAuthenticatedCustomer(auth, db)
      const { data, error } = await db.from('customers').update({ ...value, updated_at: new Date().toISOString() }).eq('id', customer.id).eq('user_id', user.id).select('id,name,phone,email').single()
      if (error) return Response.json({ error: error.code === '23505' ? '此電話已登記，請聯絡店舖協助。' : '未能儲存聯絡資料。' }, { status: error.code === '23505' ? 409 : 500, headers })
      return Response.json({ customer: publicCustomer(data, []) }, { headers })
    } catch { return Response.json({ error: '未能儲存聯絡資料。' }, { status: 500, headers }) }
  }
}

export function createCustomerMeHandler({ getServerClient: server = getServerClient, getServiceClient: service = getServiceClient } = {}) {
  return async function customerMe() {
    const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
    try {
      const db = await service()
      const customer = await resolveAuthenticatedCustomer(await server(), db)
      if (!customer) return Response.json({ error: 'authentication_required' }, { status: 401, headers })
      const packages = await usableCustomerPackages(db, customer.id)
      return Response.json({ customer: publicCustomer(customer, packages) }, { headers })
    } catch {
      return Response.json({ error: 'internal_error' }, { status: 500, headers })
    }
  }
}
