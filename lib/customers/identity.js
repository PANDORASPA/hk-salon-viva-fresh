const CUSTOMER_FIELDS = 'id,user_id,name,phone,email'

/** Only Auth's verified user ID establishes customer ownership. */
export async function resolveAuthenticatedCustomer(serverClient, serviceClient) {
  const { data: { user } = {}, error } = await serverClient.auth.getUser()
  if (error || !user?.id || user.is_anonymous) return null

  const readOwned = async () => {
    const result = await serviceClient.from('customers').select(CUSTOMER_FIELDS).eq('user_id', user.id).maybeSingle()
    if (result.error) throw result.error
    return result.data
  }
  const existing = await readOwned()
  if (existing) return existing

  // Display names in user_metadata and unverified contacts are deliberately not
  // imported. This neutral name can be edited through the owned profile later.
  const customer = {
    user_id: user.id, name: '客戶',
    email: user.email_confirmed_at && user.email ? user.email : null,
    phone: user.phone_confirmed_at && user.phone ? user.phone : null,
  }
  // DO NOTHING on user_id makes simultaneous first requests converge without
  // overwriting profile edits. Never resolve a uniqueness conflict by contact.
  let inserted = await serviceClient.from('customers').upsert(customer, { onConflict: 'user_id', ignoreDuplicates: true })
  if (inserted.error?.code === '23505' && customer.phone) {
    inserted = await serviceClient.from('customers').upsert({ ...customer, phone: null }, { onConflict: 'user_id', ignoreDuplicates: true })
  }
  if (inserted.error) throw inserted.error
  const created = await readOwned()
  if (!created) throw new Error('Customer identity creation failed')
  return created
}

export async function usableCustomerPackages(serviceClient, customerId) {
  const { data, error } = await serviceClient.from('customer_packages')
    .select('id,sessions_remaining,total_sessions,is_active,expires_at,packages(id,name,colour_hex,is_active)')
    .eq('customer_id', customerId).eq('is_active', true).gt('sessions_remaining', 0)
    .gt('expires_at', new Date().toISOString())
  if (error) throw error
  return (data || []).filter(row => row.packages?.is_active)
}

export function publicCustomer(customer, packages) {
  return { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, customer_packages: packages }
}
