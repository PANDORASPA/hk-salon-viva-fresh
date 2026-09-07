import Link from 'next/link'
import Footer from '../components/Footer'
import { isStripeMockMode } from '../../lib/payments/stripe'
import { getServerClient } from '../../lib/supabase/server'
import { defaultServices, salonDefaults } from '../../content/salon-poke-defaults'

export const metadata = {
  title: '套票購買 | SALON POKE BY VIVA',
  description: '爆毛術護理套票，多次使用更抵。完成購買後 WhatsApp 確認預約即可。',
}
export const dynamic = 'force-dynamic'

export default async function PackagesPage() {
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
          name: `${s.name} 5 次套票`,
          description: s.description,
          total_sessions: 5,
          validity_days: 365,
          price_hkd: Math.round((s.pricePence * 5) / 100 * 0.85), // 15% 折扣
          colour_hex: '#a98152',
        }))

  const mock = isStripeMockMode()
  const whatsapp = salonDefaults.contact.whatsapp

  return (
    <div className="salon">
      <header className="salon-nav">
        <div className="salon-wrap">
          <nav>
            <Link href="/">SALON POKE</Link>
            <Link href="/services">服務</Link>
            <Link href="/booking">預約</Link>
            <Link href="/packages">套票</Link>
            <Link href="/gallery">圖庫</Link>
            <Link href="/about">關於</Link>
            <Link href="/contact">聯絡</Link>
          </nav>
        </div>
      </header>
      <main className="salon-wrap salon-section">
        <h1 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 8, fontSize: 42 }}>套票購買</h1>
        <p style={{ color: '#706961', marginBottom: 8 }}>
          套票可以喺預約時使用，系統會自動扣減一次。完成付款後會喺 1 分鐘內 send WhatsApp 確認。
        </p>
        {mock && (
          <div className="form-error" style={{ marginBottom: 24, fontSize: 13 }}>
            ⚠️ 測試模式：Stripe 未配置。下單會建立 mock session 而唔會真收費。喺 production 環境要 set <code>STRIPE_SECRET_KEY</code> + <code>STRIPE_WEBHOOK_SECRET</code>。
          </div>
        )}
        {dbError && (
          <div className="form-error" style={{ marginBottom: 24 }}>{dbError}</div>
        )}

        {packages.length === 0 ? (
          <p style={{ color: '#928a81' }}>暫時未有公開套票。請聯絡我哋查詢。</p>
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
                  {pkg.description || `包含 ${pkg.total_sessions} 次服務，有效期 ${pkg.validity_days} 日。`}
                </p>
                <p style={{ fontSize: 13, color: '#928a81', marginBottom: 8 }}>
                  {pkg.total_sessions} 次 · {pkg.validity_days} 日有效
                </p>
                <p className="salon-service-price" style={{ fontSize: 28, marginBottom: 12 }}>
                  HK$ {pkg.price_hkd}
                </p>
                <PackageBuyButton pkg={pkg} />
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 40, padding: 24, background: '#f7f3ec', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia,serif' }}>其他問題</h3>
          <p style={{ color: '#706961', marginBottom: 12 }}>
            想客製化套票（例如 10 次 / 半年有效 / 多人共享）？請 WhatsApp 我哋：
          </p>
          <a className="salon-button salon-button-secondary" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener">
            WhatsApp 查詢
          </a>
        </div>
      </main>
      <Footer />
    </div>
  )
}

// Client subcomponent for the buy button
function PackageBuyButton({ pkg }) {
  // Server component cannot use event handlers — render a plain link to the
  // checkout API. The API will redirect via 302 or return the session URL.
  return (
    <a
      className="salon-button"
      href={`/api/stripe/checkout?package_id=${encodeURIComponent(pkg.id)}`}
      style={{ textAlign: 'center' }}
    >
      立即購買
    </a>
  )
}
