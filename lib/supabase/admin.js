import { getServerClient } from './server'

export async function getAdminState() {
  const supabase = await getServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, isAdmin: false, admin: null }
  const { data: admin } = await supabase.from('admin_users').select('user_id,is_active').eq('user_id', user.id).maybeSingle()
  return { user, admin: admin || null, isAdmin: admin?.is_active === true }
}

export async function requireAdmin() {
  const state = await getAdminState()
  if (!state.user) return { ...state, status: 401, error: 'Unauthorized' }
  if (!state.isAdmin) return { ...state, status: 403, error: 'Forbidden' }
  return { ...state, status: 200, error: null }
}
