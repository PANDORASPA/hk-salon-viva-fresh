import Link from 'next/link'
import Footer from '../../components/Footer'
import { getServerClient } from '../../../lib/supabase/server'
import { salonDefaults } from '../../../content/salon-poke-defaults'
import { isStripeMockMode } from '../../../lib/payments/stripe'
import Nav from '../../components/i18n/Nav'
import { t } from '../../../lib/i18n/dict'
import { getLocale } from '../../../lib/i18n/server'

export const metadata = { title: '購買完成 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default async function PackagesSuccessPage({ searchParams }) {
  const locale = getLocale()
  const sessionId = searchParams?.session_id
  const errorCode = searchParams?.error
  const whatsapp = salonDefaults.contact.whatsapp
  const mock = isStripeMockMode()

  let ticketId = null
  let fallbackError = null
  if (mock && sessionId) {
    try {
      const packageId = searchParams?.package_id
      const customerEmail = searchParams?.email
      const r = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/stripe/webhook`.replace('//api', '/api'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          package_id: packageId,
          customer_email: customerEmail,
          customer_name: searchParams?.name,
        }),
      }).catch(() => null)
      const data = await r?.json().catch(() => ({}))
      ticketId = data?.ticketId || null
    } catch (err) {
      fallbackError = err.message
    }
  }

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
          {t('success.thanks', locale)} {mock && t('success.testNotice', locale)}
        </p>

        {sessionId && (
          <div className="admin-list" style={{ marginBottom: 24 }}>
            <article>
              <div>
                <strong>{t('success.transaction', locale)}</strong>
                <p style={{ fontFamily: 'monospace', fontSize: 13 }}>{sessionId}</p>
              </div>
              <span className="status completed">{t('success.paid', locale)}</span>
            </article>
            {ticketId && (
              <article>
                <div>
                  <strong>{t('success.ticketId', locale)}</strong>
                  <p style={{ fontFamily: 'monospace', fontSize: 13 }}>#{ticketId}</p>
                </div>
                <span className="status confirmed">{t('success.issued', locale)}</span>
              </article>
            )}
          </div>
        )}

        {fallbackError && (
          <div className="form-error" style={{ marginBottom: 16 }}>
            {t('success.failedNotice', locale)}：{fallbackError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
          <Link className="salon-button" href="/booking">{t('home.cta.book', locale)}</Link>
          <a className="salon-button salon-button-secondary" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener">
            WhatsApp {t('home.cta.whatsapp', locale)}
          </a>
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
