import Link from 'next/link'
import { getServerClient } from '../../../lib/supabase/server'
import { formatAppointmentDateTime, formatPriceHkd } from '../../../lib/format'

export const metadata = { title: '預約確認 | SALON POKE BY VIVA' }
export const dynamic = 'force-dynamic'

export default async function BookingConfirmPage({ searchParams }) {
  const db = await getServerClient()
  const id = searchParams?.id

  let appointment = null
  let error = null
  if (id) {
    const { data, error: err } = await db
      .from('appointments')
      .select('id, starts_at, status, customer_name, customer_phone, services(name, price, duration_minutes)')
      .eq('id', id)
      .maybeSingle()
    if (err) error = err.message
    else appointment = data
  }

  const startsAt = appointment?.starts_at ? formatAppointmentDateTime(appointment.starts_at) : null
  const priceHkd = appointment?.services?.price != null ? formatPriceHkd(appointment.services.price) : null

  return (
    <div className="salon">
      <header className="salon-nav">
        <div className="salon-wrap">
          <nav>
            <Link href="/">SALON POKE</Link>
            <Link href="/services">服務</Link>
            <Link href="/booking">預約</Link>
            <Link href="/gallery">圖庫</Link>
            <Link href="/about">關於</Link>
            <Link href="/contact">聯絡</Link>
          </nav>
        </div>
      </header>
      <main className="salon-wrap salon-section">
        <h1 className="salon-section-title" style={{ textAlign: 'left', marginBottom: 8, fontSize: 36 }}>
          {appointment ? '預約已確認' : '查詢預約'}
        </h1>

        {error && (
          <div className="form-error">
            <strong>查詢失敗：</strong> {error}
          </div>
        )}

        {!id && !appointment && (
          <p style={{ color: '#706961' }}>沒有提供預約編號。</p>
        )}

        {appointment && (
          <>
            <p style={{ color: '#27ae60', marginBottom: 24 }}>
              ✓ 我們已收到你的預約申請，我們會盡快透過 WhatsApp 或致電確認。
            </p>
            <div className="admin-list" style={{ marginBottom: 32 }}>
              <article>
                <div>
                  <strong>預約編號</strong>
                  <p>#{appointment.id}</p>
                </div>
                <span className={`status ${appointment.status || 'pending'}`}>{appointment.status || 'pending'}</span>
              </article>
              <article>
                <div>
                  <strong>服務</strong>
                  <p>{appointment.services?.name || '—'}</p>
                </div>
                <span style={{ color: '#706961' }}>
                  {appointment.services?.duration_minutes ? `${appointment.services.duration_minutes} 分鐘` : ''}
                </span>
              </article>
              <article>
                <div>
                  <strong>時間</strong>
                  <p>{startsAt || '待確認'}</p>
                </div>
                <span style={{ color: '#706961' }}>香港時間 (Asia/Hong_Kong)</span>
              </article>
              <article>
                <div>
                  <strong>姓名</strong>
                  <p>{appointment.customer_name || '—'}</p>
                </div>
                <span style={{ color: '#706961' }}>{appointment.customer_phone || ''}</span>
              </article>
              {priceHkd && (
                <article>
                  <div>
                    <strong>費用</strong>
                    <p>HK$ {priceHkd}</p>
                  </div>
                  <span style={{ color: '#706961' }}>現場付款</span>
                </article>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              <a
                className="salon-button"
                href={`https://wa.me/85261201689?text=${encodeURIComponent(`你好！我剛在 SALON POKE 網站預約了 #${appointment.id}（${appointment.services?.name || ''}，${startsAt || ''}），請確認。`)}`}
                target="_blank"
                rel="noopener"
              >
                WhatsApp 確認
              </a>
              <a
                className="salon-button salon-button-secondary"
                href={`/api/appointments/${appointment.id}/ics`}
              >
                加入日曆 (.ics)
              </a>
              <Link className="salon-button salon-button-secondary" href="/">返回首頁</Link>
            </div>

            <div style={{ marginTop: 40, padding: 24, background: '#f7f3ec', borderRadius: 8 }}>
              <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia,serif' }}>溫馨提示</h3>
              <ul style={{ paddingLeft: 20, color: '#706961', lineHeight: 1.8 }}>
                <li>請於預約時間 5 分鐘前到達工作室。</li>
                <li>如需改期或取消，請最少提前 24 小時通知我們。</li>
                <li>使用套票預約，系統會自動扣減一次。如需取消，套票次數會自動退還。</li>
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
