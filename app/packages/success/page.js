import Link from 'next/link'
import Footer from '../../components/Footer'
import { getServerClient } from '../../../lib/supabase/server'
import { salonDefaults } from '../../../content/salon-poke-defaults'
import { isStripeMockMode } from '../../../lib/payments/stripe'

export const metadata = { title: '購買完成 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default async function PackagesSuccessPage({ searchParams }) {
  const sessionId = searchParams?.session_id
  const errorCode = searchParams?.error
  const whatsapp = salonDefaults.contact.whatsapp
  const mock = isStripeMockMode()

  // In mock mode we synchronously fire the webhook so the user_tickets
  // row is created before the success page renders. In live mode Stripe
  // will deliver the webhook asynchronously.
  let ticketId = null
  let fallbackError = null
  if (mock && sessionId) {
    try {
      // Look up the package from the search params (passed by mock checkout)
      const packageId = searchParams?.package_id
      const customerEmail = searchParams?.email
      const r = await fetch(`${salonDefaults.contact.website || ''}/api/stripe/webhook`.replace('//api', '/api'), {
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
        <header className="salon-nav">
          <div className="salon-wrap">
            <nav>
              <Link href="/">SALON POKE</Link>
              <Link href="/packages">套票</Link>
            </nav>
          </div>
        </header>
        <main className="salon-wrap salon-section">
          <h1 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 8, fontSize: 36 }}>付款未完成</h1>
          <p style={{ color: '#706961', marginBottom: 24 }}>
            請重新嘗試：<Link href="/packages">返回套票頁</Link>
          </p>
          <p style={{ color: '#c0392b', fontSize: 13 }}>錯誤代碼：{errorCode}</p>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="salon">
      <header className="salon-nav">
        <div className="salon-wrap">
          <nav>
            <Link href="/">SALON POKE</Link>
            <Link href="/packages">套票</Link>
            <Link href="/booking">預約</Link>
            <Link href="/account">我的帳戶</Link>
          </nav>
        </div>
      </header>
      <main className="salon-wrap salon-section">
        <h1 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 8, fontSize: 36, color: '#27ae60' }}>
          ✓ 付款成功
        </h1>
        <p style={{ color: '#706961', marginBottom: 24 }}>
          感謝你購買 SALON POKE BY VIVA 套票。{mock && '（測試模式：mock session，套票已即時發行）'}
        </p>

        {sessionId && (
          <div className="admin-list" style={{ marginBottom: 24 }}>
            <article>
              <div>
                <strong>交易編號</strong>
                <p style={{ fontFamily: 'monospace', fontSize: 13 }}>{sessionId}</p>
              </div>
              <span className="status completed">已付款</span>
            </article>
            {ticketId && (
              <article>
                <div>
                  <strong>套票編號</strong>
                  <p style={{ fontFamily: 'monospace', fontSize: 13 }}>#{ticketId}</p>
                </div>
                <span className="status confirmed">已發行</span>
              </article>
            )}
          </div>
        )}

        {fallbackError && (
          <div className="form-error" style={{ marginBottom: 16 }}>
            套票自動發行失敗，請聯絡我哋：{fallbackError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
          <Link className="salon-button" href="/booking">立即預約</Link>
          <a className="salon-button salon-button-secondary" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener">
            WhatsApp 確認
          </a>
          <Link className="salon-button salon-button-secondary" href="/account">查看我的套票</Link>
        </div>

        <div style={{ marginTop: 40, padding: 24, background: '#f7f3ec', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia,serif' }}>溫馨提示</h3>
          <ul style={{ paddingLeft: 20, color: '#706961', lineHeight: 1.8 }}>
            <li>套票已自動加入你嘅帳戶，可以即時用嚟預約。</li>
            <li>預約時輸入同一個電話號碼，系統會自動偵測可用套票並扣減一次。</li>
            <li>如需取消預約，套票次數會自動退還。</li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  )
}
