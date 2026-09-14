import { getServerClient } from '../supabase/server.js'
import { getServiceClient } from '../supabase/service.js'
import { resolveAuthenticatedCustomer, usableCustomerPackages, publicCustomer } from './identity.js'

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
