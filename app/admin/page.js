import { redirect } from 'next/navigation'
import { getAdminState } from '../../lib/supabase/admin'
import AdminShell from './AdminShell'

export const metadata = { title: 'Admin' }
export default async function AdminPage(){ const state=await getAdminState();if(!state.user)redirect('/admin/login?redirectTo=/admin');if(!state.isAdmin)redirect('/admin/login?denied=1');return <AdminShell email={state.user.email} /> }
