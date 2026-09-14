function errorMessage(body, fallback) {
  return body?.error || fallback
}

export function packageResult(packages, error = '') {
  if (error) return { status: 'error', packages: [], error }
  return packages?.length ? { status: 'ready', packages } : { status: 'empty', packages: [] }
}

export async function loadCustomerPackages(fetcher, signal) {
  const response = await fetcher('/api/customers/me', { signal })
  const body = await response.json()
  if (!response.ok) throw new Error(errorMessage(body, response.status === 401 ? '登入狀態已失效，請重新登入。' : '暫時無法載入套票'))
  const customer = body.customer
  return { ...packageResult(customer?.customer_packages || []), contact: { name: customer?.name || '', phone: customer?.phone || '', email: customer?.email || '' } }
}

export function filterCustomerPackages(packages, serviceId, startsAt) {
  const start = Date.parse(startsAt)
  return packages.filter(row => row.is_active === true && row.sessions_remaining > 0 && Date.parse(row.expires_at) > start
    && row.packages?.is_active === true && row.packages.package_services?.some(link => Number(link.service_id) === Number(serviceId)))
}

export async function loadAvailability(fetcher, { date, serviceId, staffPreference }, signal) {
  const params = new URLSearchParams({ date, serviceId: String(serviceId), staffId: String(staffPreference) })
  const response = await fetcher(`/api/availability?${params}`, { signal })
  const body = await response.json()
  if (!response.ok) throw new Error(errorMessage(body, '無法載入時段'))
  const slots = body.slots || []
  return { slots, message: slots.length ? '請選擇可預約時段。' : '當日無可預約時段，請選擇其他日期。' }
}
