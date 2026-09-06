import { getServerClient } from '../../lib/supabase/server'
import PackagePurchaseForm from './PackagePurchaseForm'

export const metadata = {
  title: '套票計劃 | SALON POKE BY VIVA',
  description: '選擇適合你的套票計劃，省錢又方便。專業髮型服務，彈性使用。',
}

export const dynamic = 'force-dynamic'

export default async function PackagesPage() {
  const db = await getServerClient()
  const { data: packages } = await db
    .from('packages')
    .select(`
      id, name, colour_hex, description, total_sessions, validity_days, price_hkd,
      package_services(service_id, services(id, name, duration_minutes, price))
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  return (
    <div className="salon">
      <div className="salon-page-intro">
        <p className="salon-kicker">套票計劃</p>
        <h1>選擇適合你的方案</h1>
        <p className="salon-lead">
          購買套票可享優惠價格，彈性預約，適用於多种服務
        </p>
      </div>

      <section className="salon-section">
        <div className="salon-wrap">
          {packages?.length > 0 ? (
            <div className="packages-grid">
              {packages.map((pkg, index) => {
                const services = pkg.package_services?.map(ps => ps.services).filter(Boolean) || []
                const perSession = pkg.price_hkd > 0 && pkg.total_sessions > 0
                  ? Math.round(pkg.price_hkd / pkg.total_sessions)
                  : null

                return (
                  <div
                    key={pkg.id}
                    className="package-purchase-card"
                    style={{
                      animationDelay: `${index * 100}ms`,
                      '--pkg-color': pkg.colour_hex || '#a98152',
                    }}
                  >
                    <div className="pkg-header">
                      <div className="pkg-color-bar" />
                      <h3 className="pkg-name">{pkg.name}</h3>
                      {pkg.description && (
                        <p className="pkg-desc">{pkg.description}</p>
                      )}
                    </div>

                    <div className="pkg-price-block">
                      <span className="pkg-price">HK${pkg.price_hkd.toLocaleString()}</span>
                      <span className="pkg-price-label">總價</span>
                    </div>

                    <div className="pkg-stats">
                      <div className="pkg-stat">
                        <span className="pkg-stat-value">{pkg.total_sessions}</span>
                        <span className="pkg-stat-label">次服務</span>
                      </div>
                      <div className="pkg-stat">
                        <span className="pkg-stat-value">{pkg.validity_days}</span>
                        <span className="pkg-stat-label">天有效期</span>
                      </div>
                      {perSession && (
                        <div className="pkg-stat">
                          <span className="pkg-stat-value">HK${perSession}</span>
                          <span className="pkg-stat-label">平均/次</span>
                        </div>
                      )}
                    </div>

                    {services.length > 0 && (
                      <div className="pkg-services">
                        <p className="pkg-services-title">包含服務：</p>
                        <div className="pkg-services-list">
                          {services.map(svc => (
                            <span key={svc.id} className="pkg-service-tag">
                              ✂️ {svc.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      className="pkg-select-btn"
                      onClick={() => {
                        document.getElementById(`purchase-form-${pkg.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }}
                    >
                      選擇此方案
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px' }}>
              目前暫無套票計劃，請留意我們的更新。
            </p>
          )}
        </div>
      </section>

      {/* Purchase Forms */}
      {packages?.length > 0 && (
        <section className="salon-section" style={{ background: 'var(--cream-dark)' }}>
          <div className="salon-wrap">
            <h2 className="salon-section-title">購買套票</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 32, marginTop: -24 }}>
              選擇你心儀的套票，填寫聯絡資料，我們會盡快與你聯繫確認
            </p>
            <div className="purchase-forms">
              {packages.map(pkg => (
                <div key={pkg.id} id={`purchase-form-${pkg.id}`} className="purchase-form-section">
                  <div className="purchase-form-header">
                    <span className="purchase-form-pkg-name" style={{ color: pkg.colour_hex || 'var(--gold)' }}>
                      {pkg.name}
                    </span>
                    <span className="purchase-form-pkg-price">HK${pkg.price_hkd.toLocaleString()}</span>
                  </div>
                  <PackagePurchaseForm package={pkg} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="salon-footer">
        <div className="salon-footer-grid">
          <div>
            <p className="salon-footer-brand">SALON POKE BY VIVA</p>
            <p className="salon-footer-tagline">專業髮型服務 · 亞洲人髮絲專家</p>
          </div>
          <div>
            <p className="salon-footer-heading">快捷連結</p>
            <nav>
              <a href="/">主頁</a>
              <a href="/services">服務</a>
              <a href="/booking">預約</a>
              <a href="/about">關於</a>
            </nav>
          </div>
          <div>
            <p className="salon-footer-heading">資訊</p>
            <nav>
              <a href="/terms">使用條款</a>
              <a href="/privacy">隱私政策</a>
            </nav>
          </div>
        </div>
        <p className="salon-footer-copy">© {new Date().getFullYear()} SALON POKE BY VIVA. 保留所有權利。</p>
      </footer>
    </div>
  )
}
