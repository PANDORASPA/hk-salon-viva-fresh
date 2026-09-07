import Footer from '../components/Footer'
import { isStripeMockMode } from '../../lib/payments/stripe'
import { getServerClient } from '../../lib/supabase/server'
import { defaultServices, salonDefaults } from '../../content/salon-poke-defaults'
import Nav from '../components/i18n/Nav'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'

export const metadata = {
  title: '套票購買 | SALON POKE BY VIVA',
  description: '爆毛術護理套票，多次使用更抵。完成購買後 WhatsApp 確認預約即可。',
}
export const dynamic = 'force-dynamic'

export default async function PackagesPage() {
  const locale = getLocale()
  let dbPackages = []
  let dbError = null
  try {
    const db = await getServerClient()
    const { data, error } = await db
      .from('packages')
      .select('id, name, description, total_sessions, validity_days, price_hkd, colour_hex, is_active')
      .eq('is_active', true)
      .order('price_hkd', { ascending: true })
    if (error) dbError = error.message
    dbPackages = data || []
  } catch {
    // env not configured
  }

  const packages = dbPackages.length
    ? dbPackages
    : defaultServices
        .filter(s => /套|爆毛|增髮|護理/.test(s.name) || s.pricePence >= 28000)
        .map((s, i) => ({
          id: `fallback-${i}`,
          name: locale === 'en' ? `${s.name} 5-session package` : `${s.name} 5 次套票`,
          description: s.description,
          total_sessions: 5,
          validity_days: 365,
          price_hkd: Math.round((s.pricePence * 5) / 100 * 0.85),
          colour_hex: '#a98152',
        }))

  const mock = isStripeMockMode()
  const whatsapp = salonDefaults.contact.whatsapp

  return (
    <div className="salon">
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <h1 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 8, fontSize: 42 }}>
          {t('packages.title', locale)}
        </h1>
        <p style={{ color: '#706961', marginBottom: 8 }}>
          {t('packages.subtitle', locale)}
        </p>
        {mock && (
          <div className="form-error" style={{ marginBottom: 24, fontSize: 13 }}>
            ⚠️ {t('packages.mockBanner', locale)}
          </div>
        )}
        {dbError && (
          <div className="form-error" style={{ marginBottom: 24 }}>{dbError}</div>
        )}

        {packages.length === 0 ? (
          <p style={{ color: '#928a81' }}>{t('packages.empty', locale)}</p>
        ) : (
          <div className="salon-services" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {packages.map(pkg => (
              <div
                key={pkg.id}
                className="salon-service-card"
                style={{ borderLeft: `6px solid ${pkg.colour_hex || '#a98152'}`, display: 'flex', flexDirection: 'column' }}
              >
                <h3 style={{ marginBottom: 4 }}>{pkg.name}</h3>
                <p style={{ color: '#706961', fontSize: 14, marginBottom: 12, flex: 1 }}>
                  {pkg.description || (locale === 'en'
                    ? `Includes ${pkg.total_sessions} sessions, valid for ${pkg.validity_days} days.`
                    : `包含 ${pkg.total_sessions} 次服務，有效期 ${pkg.validity_days} 日。`)}
                </p>
                <p style={{ fontSize: 13, color: '#928a81', marginBottom: 8 }}>
                  {pkg.total_sessions}{t('packages.sessionsUnit', locale)} · {pkg.validity_days}{t('packages.daysUnit', locale)}
                </p>
                <p className="salon-service-price" style={{ fontSize: 28, marginBottom: 12 }}>
                  HK$ {pkg.price_hkd}
                </p>
                <PackageBuyButton pkg={pkg} label={t('packages.buy', locale)} />
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 40, padding: 24, background: '#f7f3ec', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia,serif' }}>
            {t('packages.custom.title', locale)}
          </h3>
          <p style={{ color: '#706961', marginBottom: 12 }}>
            {t('packages.custom.body', locale)}
          </p>
          <a className="salon-button salon-button-secondary" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener">
            WhatsApp {locale === 'en' ? 'us' : ''}
          </a>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function PackageBuyButton({ pkg, label }) {
  return (
    <a
      className="salon-button"
      href={`/api/stripe/checkout?package_id=${encodeURIComponent(pkg.id)}`}
      style={{ textAlign: 'center' }}
    >
      {label}
    </a>
  )
}
