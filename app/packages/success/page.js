import Link from 'next/link'
import Footer from '../../components/Footer'
import Nav from '../../components/i18n/Nav'
import { t } from '../../../lib/i18n/dict'
import { getLocale } from '../../../lib/i18n/server'
import { getServerClient } from '../../../lib/supabase/server'
import { publicContact } from '../../../lib/content/public-contact.js'

export const metadata = { title: '購買完成 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default async function PackagesSuccessPage({ searchParams }) {
  const locale = getLocale()
  const sessionId = searchParams?.session_id
  const errorCode = searchParams?.error
  let contact = publicContact()
  try {
    const db = await getServerClient()
    const { data } = await db.from('site_content').select('data').eq('id', 1).maybeSingle()
    contact = publicContact(data?.data?.contact)
  } catch {}

  if (errorCode) {
    return (
      <div className="salon">
        <Nav locale={locale} />
        <main className="salon-wrap salon-section">
          <h1 className="salon-section-title present-82d03763" >
            {t('success.errorTitle', locale)}
          </h1>
          <p className="present-c77315de">
            {locale === 'en' ? 'Please try again: ' : '請重新嘗試：'}
            <Link href="/packages">{t('success.retry', locale)}</Link>
          </p>
          <p className="present-ec95e86b">
            {t('success.errorCode', locale)}: {errorCode}
          </p>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <h1 className="salon-section-title present-35a03eeb" >
          ✓ {t('success.title', locale)}
        </h1>
        <p className="present-c77315de">
          感謝你的訂單。我們正等待付款平台的已驗證通知；套票會在確認後發出。
        </p>

        {sessionId && (
          <div className="admin-list present-fec3619e" >
            <article>
              <div>
                <strong>{t('success.transaction', locale)}</strong>
                <p className="present-83d5167f">{sessionId}</p>
              </div>
              <span className="status pending">付款確認中</span>
            </article>
          </div>
        )}


        <div className="present-4aef36d8">
          <Link className="salon-button" href="/booking">{t('home.cta.book', locale)}</Link>
          {contact.whatsappHref ? <a className="salon-button salon-button-secondary" href={contact.whatsappHref} target="_blank" rel="noopener">WhatsApp {t('home.cta.whatsapp', locale)}</a> : null}
          <Link className="salon-button salon-button-secondary" href="/account">{t('nav.account', locale)}</Link>
        </div>

        <div className="present-60755ad6">
          <h3 className="present-e68a0e44">{t('confirm.tips.0', locale).slice(0, -1)}</h3>
          <ul className="present-b4e92141">
            <li>{t('success.tips.0', locale)}</li>
            <li>{t('success.tips.1', locale)}</li>
            <li>{t('success.tips.2', locale)}</li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  )
}
