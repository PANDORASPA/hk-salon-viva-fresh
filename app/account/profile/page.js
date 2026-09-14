import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerClient } from '../../../lib/supabase/server'
import Nav from '../../components/i18n/Nav'
import ProfileForm from './ProfileForm'
import { resolveAuthenticatedCustomer } from '../../../lib/customers/identity.js'
import { getServiceClient } from '../../../lib/supabase/service.js'
import { getLocale } from '../../../lib/i18n/server'

export const metadata = { title: '編輯個人資料 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const locale = await getLocale()
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/signin?redirectTo=/account/profile')

  const profile = await resolveAuthenticatedCustomer(db, getServiceClient())

  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <div className="present-110bc484">
          <h1 className="salon-section-title present-609d08b8" >
            {locale === 'en' ? 'Edit profile' : '編輯個人資料'}
          </h1>
          <Link href="/account" className="present-78539e49">
            ← {locale === 'en' ? 'Back to account' : '返回帳戶'}
          </Link>
        </div>

        <div className="present-5951a95a">
          <ProfileForm
            initialProfile={profile}
            initialEmail={profile?.email}
            locale={locale}
          />
        </div>
      </main>
    </div>
  )
}
