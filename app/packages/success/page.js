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
          <h1 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 8, fontSize: 36 }}>
            {t('success.errorTitle', locale)}
          </h1>
          <p style={{ color: '#706961', marginBottom: 24 }}>
            {locale === 'en' ? 'Please try again: ' : '請重新嘗試：'}
            <Link href="/packages">{t('success.retry', locale)}</Link>
          </p>
          <p style={{ color: '#c0392b', fontSize: 13 }}>
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
        <h1 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 8, fontSize: 36, color: '#27ae60' }}>
          ✓ {t('success.title', locale)}
        </h1>
        <p style={{ color: '#706961', marginBottom: 24 }}>
          感謝你的訂單。我們正等待付款平台的已驗證通知；套票會在確認後發出。
        </p>

        {sessionId && (
          <div className="admin-list" style={{ marginBottom: 24 }}>
            <article>
              <div>
                <strong>{t('success.transaction', locale)}</strong>
                <p style={{ fontFamily: 'monospace', fontSize: 13 }}>{sessionId}</p>
              </div>
              <span className="status pending">付款確認中</span>
            </article>
          </div>
        )}


        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
          <Link className="salon-button" href="/booking">{t('home.cta.book', locale)}</Link>
          {contact.whatsappHref ? <a className="salon-button salon-button-secondary" href={contact.whatsappHref} target="_blank" rel="noopener">WhatsApp {t('home.cta.whatsapp', locale)}</a> : null}
          <Link className="salon-button salon-button-secondary" href="/account">{t('nav.account', locale)}</Link>
        </div>

        <div style={{ marginTop: 40, padding: 24, background: '#f7f3ec', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia,serif' }}>{t('confirm.tips.0', locale).slice(0, -1)}</h3>
          <ul style={{ paddingLeft: 20, color: '#706961', lineHeight: 1.8 }}>
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
