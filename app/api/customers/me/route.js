import { createCustomerMeHandler, createCustomerProfileHandler } from '../../../../lib/customers/http.js'

export const dynamic = 'force-dynamic'
export const GET = createCustomerMeHandler()
export const PATCH = createCustomerProfileHandler()
