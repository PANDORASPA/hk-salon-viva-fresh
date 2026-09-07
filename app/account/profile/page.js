import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerClient } from '../../../lib/supabase/server'
import Nav from '../../components/i18n/Nav'
import ProfileForm from './ProfileForm'
import { t } from '../../../lib/i18n/dict'
import { getLocale } from '../../../lib/i18n/server'

export const metadata = { title: '編輯個人資料 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const locale = getLocale()
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/signin?redirectTo=/account/profile')

  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <h1 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 0, fontSize: 36 }}>
            {locale === 'en' ? 'Edit profile' : '編輯個人資料'}
          </h1>
          <Link href="/account" style={{ color: '#a98152', fontSize: 14 }}>
            ← {locale === 'en' ? 'Back to account' : '返回帳戶'}
          </Link>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 28, maxWidth: 480 }}>
          <ProfileForm
            initialProfile={profile}
            initialEmail={user.email}
            locale={locale}
          />
        </div>
      </main>
    </div>
  )
}
