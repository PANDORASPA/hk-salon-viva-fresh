import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerClient } from '../../lib/supabase/server'
import SignOutButton from './SignOutButton'
import BookingsClient from './BookingsClient'
import Nav from '../components/i18n/Nav'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'

export const metadata = { title: '我的帳戶 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const locale = getLocale()
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect(`/signin?redirectTo=/account`)

  const [{ data: profile }, { data: appointments }, { data: customerPackages }] = await Promise.all([
    db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    db.from('appointments')
      .select('id, starts_at, status, customer_package_id, services(name, duration_minutes)')
      .eq('user_id', user.id)
      .order('starts_at', { ascending: false })
      .limit(50),
    db.from('customer_packages')
      .select('id, sessions_remaining, total_sessions, is_active, expires_at, packages(name, colour_hex)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <h1 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 8, fontSize: 36 }}>
          {t('account.title', locale)}
        </h1>
        <p style={{ color: '#706961', marginBottom: 32 }}>
          {t('account.signedIn', locale)}：{profile?.full_name || user.email}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 40 }}>
          <Link className="salon-button" href="/booking">{t('account.cta.book', locale)}</Link>
          <SignOutButton />
        </div>

        <h2 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 20, fontSize: 24 }}>
          {t('account.packages', locale)}
        </h2>
        {customerPackages?.length ? (
          <div className="admin-list" style={{ marginBottom: 40 }}>
            {customerPackages.map(cp => {
              const now = Date.now()
              const expired = new Date(cp.expires_at).getTime() <= now
              const status =
                cp.sessions_remaining === 0 ? 'exhausted' :
                !cp.is_active ? 'inactive' :
                expired ? 'expired' : 'active'
              return (
                <article key={cp.id}>
                  <div>
                    <strong>{cp.packages?.name || t('account.packages', locale)}</strong>
                    <p>
                      {locale === 'en'
                        ? `${cp.sessions_remaining}/${cp.total_sessions} sessions left`
                        : `剩餘 ${cp.sessions_remaining}/${cp.total_sessions} 次`}
                      {cp.expires_at && ` · ${t('account.package.expires', locale)} ${new Date(cp.expires_at).toLocaleDateString('zh-HK')}`}
                    </p>
                  </div>
                  <span
                    className="status"
                    style={{
                      background: status === 'exhausted' || status === 'expired' ? '#fee2e2' : status === 'active' ? '#d1fae5' : '#f3f4f6',
                      color: status === 'exhausted' || status === 'expired' ? '#991b1b' : status === 'active' ? '#065f46' : '#374151',
                    }}
                  >
                    {t(`account.package.${status}`, locale)}
                  </span>
                </article>
              )
            })}
          </div>
        ) : (
          <p style={{ color: '#928a81', marginBottom: 40 }}>{t('account.empty.packages', locale)}</p>
        )}

        <h2 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 20, fontSize: 24 }}>
          {t('account.bookings', locale)}
        </h2>
        <BookingsClient initialBookings={appointments || []} />

        <div style={{ marginTop: 40, padding: 24, background: '#f7f3ec', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia,serif' }}>{t('account.contact.title', locale)}</h3>
          <p style={{ color: '#706961', marginBottom: 16 }}>{t('account.contact.body', locale)}</p>
          <a className="salon-button" href="https://wa.me/852XXXXXXXX" target="_blank" rel="noopener">
            {t('account.contact.cta', locale)}
          </a>
        </div>
      </main>
    </div>
  )
}
