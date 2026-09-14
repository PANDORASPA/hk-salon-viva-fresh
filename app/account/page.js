import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerClient } from '../../lib/supabase/server'
import { getServiceClient } from '../../lib/supabase/service'
import { resolveAuthenticatedCustomer, usableCustomerPackages } from '../../lib/customers/identity'
import SignOutButton from './SignOutButton'
import BookingsClient from './BookingsClient'
import Nav from '../components/i18n/Nav'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'
import { ACCOUNT_BOOKING_SELECT, toAccountBooking } from '../../lib/booking/account-booking-view.js'
import { publicContact } from '../../lib/content/public-contact.js'

export const metadata = { title: '我的帳戶 | SALON POKE BY VIVA', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const locale = await getLocale()
  const db = await getServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user || user.is_anonymous) redirect(`/signin?redirectTo=/account`)
  const serviceDb = getServiceClient()
  const customer = await resolveAuthenticatedCustomer(db, serviceDb)
  if (!customer) redirect(`/signin?redirectTo=/account`)

  const [{ data: appointments }, customerPackages, { data: siteContent }] = await Promise.all([
    serviceDb.from('appointments')
      .select(ACCOUNT_BOOKING_SELECT)
      .eq('user_id', user.id)
      .order('starts_at', { ascending: false })
      .limit(50),
    usableCustomerPackages(serviceDb, customer.id),
    serviceDb.from('site_content').select('data').eq('id', 1).maybeSingle(),
  ])
  const contact = publicContact(siteContent?.data?.contact)

  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <h1 className="salon-section-title present-82d03763" >
          {t('account.title', locale)}
        </h1>
        <p className="present-33a284d0">
          {t('account.signedIn', locale)}：{customer.name || user.email}
        </p>
        <div className="present-e7063cce">
          <Link className="salon-button" href="/booking">{t('account.cta.book', locale)}</Link>
          <Link className="admin-action" href="/account/profile">
            {locale === 'en' ? 'Edit profile' : '編輯個人資料'}
          </Link>
          <SignOutButton />
        </div>

        <h2 className="salon-section-title present-1892535d" >
          {t('account.packages', locale)}
        </h2>
        {customerPackages?.length ? (
          <div className="admin-list present-6feba752" >
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
                    className={`status ${status === 'exhausted' || status === 'expired' ? 'cancelled' : status === 'active' ? 'completed' : 'no_show'}`}
                  >
                    {t(`account.package.${status}`, locale)}
                  </span>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="present-a0160dd3">{t('account.empty.packages', locale)}</p>
        )}

        <h2 id="bookings" className="salon-section-title present-1892535d" >
          {t('account.bookings', locale)}
        </h2>
        <BookingsClient initialBookings={(appointments || []).map(toAccountBooking)} />

        {contact.whatsappHref ? <div className="present-60755ad6">
          <h3 className="present-e68a0e44">{t('account.contact.title', locale)}</h3>
          <p className="present-0c4c6aff">{t('account.contact.body', locale)}</p>
          <a className="salon-button" href={contact.whatsappHref} target="_blank" rel="noopener">
            {t('account.contact.cta', locale)}
          </a>
        </div> : null}
      </main>
    </div>
  )
}
