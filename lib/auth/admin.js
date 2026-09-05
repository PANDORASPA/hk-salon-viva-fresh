const resolveAdminState = async ({ user, findAdmin }) => {
  if (!user?.id) return { user: null, isAdmin: false }
  const row = await findAdmin(user.id)
  return { user, isAdmin: row?.user_id === user.id && row?.is_active === true, admin: row || null }
}

module.exports = { resolveAdminState }
