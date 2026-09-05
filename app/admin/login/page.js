import { redirect } from 'next/navigation'
import { getServerClient } from '../../../lib/supabase/server'
import AdminShell from '../../AdminShell'

export const metadata = { title: '管理員登入 | SALON POKE BY VIVA' }

export default async function AdminLoginPage() {
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/signin?redirectTo=/admin')

  return <AdminShell email={user.email} />
}
