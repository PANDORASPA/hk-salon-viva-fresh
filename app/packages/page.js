import Footer from '../components/Footer'
import { NonceStyle } from '../components/DocumentNonce'
import { packageAccentCss } from '../../lib/content/package-accent.js'
import { isStripeConfigured } from '../../lib/payments/stripe'
import { getServerClient } from '../../lib/supabase/server'
import { defaultServices } from '../../content/salon-poke-defaults'
import Nav from '../components/i18n/Nav'
import { t } from '../../lib/i18n/dict'
import { getLocale } from '../../lib/i18n/server'
import { publicContact } from '../../lib/content/public-contact.js'

export const metadata = {
  title: '套票購買 | SALON POKE BY VIVA',
  description: '爆毛術護理套票，多次使用更抵。完成購買後 WhatsApp 確認預約即可。',
}
export const dynamic = 'force-dynamic'

export default async function PackagesPage() {
  const locale = await getLocale()
  let dbPackages = []
  let dbError = null
  let contact = publicContact()
  try {
    const db = await getServerClient()
    const { data, error } = await db
      .from('packages')
      .select('id, name, description, total_sessions, validity_days, price_hkd, colour_hex, is_active')
      .eq('is_active', true)
      .order('price_hkd', { ascending: true })
    if (error) dbError = error.message
    dbPackages = data || []
    const { data: content } = await db.from('site_content').select('data').eq('id', 1).maybeSingle()
    contact = publicContact(content?.data?.contact)
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

  const purchasesEnabled = isStripeConfigured()
  return (
    <div className="salon">
      <NonceStyle>{packageAccentCss(packages)}</NonceStyle>
      <Nav locale={locale} />
      <main className="salon-wrap salon-section">
        <h1 className="salon-section-title present-43941296" >
          {t('packages.title', locale)}
        </h1>
        <p className="present-8433b878">
          {t('packages.subtitle', locale)}
        </p>
        {!purchasesEnabled && (
          <div className="form-error present-81f004d1" >
            網上付款尚未啟用。請透過網站已提供的聯絡方式安排購買，現時不會建立模擬付款。
          </div>
        )}
        {dbError && (
          <div className="form-error present-fec3619e" >{dbError}</div>
        )}

        {packages.length === 0 ? (
          <p className="present-62f09da3">{t('packages.empty', locale)}</p>
        ) : (
          <div className="salon-services present-ff340128" >
            {packages.map((pkg, index) => (
              <div
                key={pkg.id}
                className={`salon-service-card package-card package-accent-${index}`}
              >
                <h3 className="present-6e7202d3">{pkg.name}</h3>
                <p className="present-eccca7ae">
                  {pkg.description || (locale === 'en'
                    ? `Includes ${pkg.total_sessions} sessions, valid for ${pkg.validity_days} days.`
                    : `包含 ${pkg.total_sessions} 次服務，有效期 ${pkg.validity_days} 日。`)}
                </p>
                <p className="present-61acfde2">
                  {pkg.total_sessions}{t('packages.sessionsUnit', locale)} · {pkg.validity_days}{t('packages.daysUnit', locale)}
                </p>
                <p className="salon-service-price present-82e23340" >
                  HK$ {pkg.price_hkd}
                </p>
                <PackageBuyButton pkg={pkg} label={t('packages.buy', locale)} enabled={purchasesEnabled} />
              </div>
            ))}
          </div>
        )}

        <div className="present-60755ad6">
          <h3 className="present-e68a0e44">
            {t('packages.custom.title', locale)}
          </h3>
          <p className="present-933a7750">
            {t('packages.custom.body', locale)}
          </p>
          {contact.whatsappHref ? <a className="salon-button salon-button-secondary" href={contact.whatsappHref} target="_blank" rel="noopener">WhatsApp {locale === 'en' ? 'us' : ''}</a> : null}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function PackageBuyButton({ pkg, label, enabled }) {
  if (!enabled) return <button className="salon-button" type="button" disabled title="網上付款尚未啟用">網上付款尚未啟用</button>
  return (
    <a
      className="salon-button present-fb5ec070"
      href={`/api/stripe/checkout?package_id=${encodeURIComponent(pkg.id)}`}

    >
      {label}
    </a>
  )
}
