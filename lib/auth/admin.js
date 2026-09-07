/**
 * Server-side admin state resolution.
 *
 * `resolveAdminState({ user, findAdmin })` is the pure helper used by route
 * handlers and the `/admin` RSC entry. It is intentionally side-effect free
 * so the call site (route handler or page) can pass in a mocked
 * `findAdmin` function in tests.
 *
 * Production callers (see `lib/supabase/admin.js`) supply:
 *   user      = (await getServerClient().auth.getUser()).data.user
 *   findAdmin = async (userId) => (await db.from('admin_users').select(...).eq('user_id', userId).maybeSingle()).data
 *
 * The legacy Bristol version of this file lives in `lib/supabase/admin.js`
 * and provides `getAdminState()` / `requireAdmin()` for the existing admin
 * pages. Both shapes are supported.
 */
export async function resolveAdminState({ user, findAdmin }) {
  if (!user) return { user: null, isAdmin: false }
  const row = typeof findAdmin === 'function' ? await findAdmin(user.id) : null
  return { user, isAdmin: Boolean(row?.is_active) }
}

export default { resolveAdminState }
