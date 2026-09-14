import { getServiceClient } from '../../../lib/supabase/service.js'

export function createServicesHandler({ getServiceClient: serviceClient = getServiceClient } = {}) {
  return async function servicesHandler() {
    try {
      const db = await serviceClient()
      const { data, error } = await db.from('services')
        .select('id,name,price,duration_minutes,category')
        .eq('published', true)
        .eq('enabled', true)
        .order('sort_order')
      if (error) throw error
      return Response.json({ services: data || [] })
    } catch {
      return Response.json({ error: '暫時無法載入服務，請稍後再試。' }, { status: 503 })
    }
  }
}

export const GET = createServicesHandler()
