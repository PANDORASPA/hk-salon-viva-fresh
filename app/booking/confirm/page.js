import Link from 'next/link'
import { getServerClient } from '../../../lib/supabase/server.js'
import { getServiceClient } from '../../../lib/supabase/service.js'
import { loadConfirmationAppointment } from '../../../lib/booking/confirmation.js'
import { formatAppointmentDateTime, formatPriceHkd } from '../../../lib/format.js'

export const metadata = {
  title: '預約確認 | SALON POKE BY VIVA',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}
export const dynamic = 'force-dynamic'

export default async function BookingConfirmPage({ searchParams }) {
  const query = await searchParams
  const id = query?.id
  const confirmationToken = query?.token
  const db = await getServerClient()
  const { data: { user } = {} } = await db.auth.getUser()

  let appointment = null
  let error = null
  try {
    appointment = await loadConfirmationAppointment({
      id,
      confirmationToken,
      user,
      serverDatabase: db,
      // Only token requests initialize the service-role client. Owner reads
      // remain scoped to the authenticated browser session and RLS.
      serviceDatabase: getServiceClient,
    })
  } catch {
    error = '暫時無法讀取預約資料，請稍後再試。'
  }

  const startsAt = appointment?.starts_at ? formatAppointmentDateTime(appointment.starts_at) : null
  const priceHkd = appointment?.services?.price != null ? formatPriceHkd(appointment.services.price) : null
  const calendarHref = appointment
    ? `/api/appointments/${appointment.id}/ics${confirmationToken ? `?token=${encodeURIComponent(confirmationToken)}` : ''}`
    : null

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

        {error && <div className="form-error" role="alert">{error}</div>}

        {!error && !appointment && (
          <p style={{ color: '#706961' }}>
            {id ? '預約連結無效或已失效。請登入帳戶查看你的預約，或使用確認電郵中的專屬連結。' : '沒有提供有效的預約連結。'}
          </p>
        )}

        {appointment && (
          <>
            <p style={{ color: '#27ae60', marginBottom: 24 }}>
              ✓ 我們已收到你的預約申請，我們會盡快透過 WhatsApp 或致電確認。
            </p>
            <div className="admin-list" style={{ marginBottom: 32 }}>
              <article>
                <div><strong>預約編號</strong><p>{appointment.reference || `#${appointment.id}`}</p></div>
                <span className={`status ${appointment.status || 'pending'}`}>{appointment.status || 'pending'}</span>
              </article>
              <article>
                <div><strong>服務</strong><p>{appointment.services?.name || '—'}</p></div>
                <span style={{ color: '#706961' }}>{appointment.services?.duration_minutes ? `${appointment.services.duration_minutes} 分鐘` : ''}</span>
              </article>
              <article>
                <div><strong>服務員工</strong><p>{appointment.staff?.display_name || '待安排'}</p></div>
                <span style={{ color: '#706961' }}>已安排員工</span>
              </article>
              <article>
                <div><strong>時間</strong><p>{startsAt || '待確認'}</p></div>
                <span style={{ color: '#706961' }}>香港時間 (Asia/Hong_Kong)</span>
              </article>
              {priceHkd && (
                <article>
                  <div><strong>費用</strong><p>HK$ {priceHkd}</p></div>
                  <span style={{ color: '#706961' }}>現場付款</span>
                </article>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              <a className="salon-button" href={`https://wa.me/85261201689?text=${encodeURIComponent(`你好！我剛在 SALON POKE 網站預約了 ${appointment.reference || `#${appointment.id}`}（${appointment.services?.name || ''}，${startsAt || ''}），請確認。`)}`} target="_blank" rel="noopener">WhatsApp 確認</a>
              <a className="salon-button salon-button-secondary" href={calendarHref}>加入日曆 (.ics)</a>
              <Link className="salon-button salon-button-secondary" href="/">返回首頁</Link>
            </div>

            <div style={{ marginTop: 40, padding: 24, background: '#f7f3ec', borderRadius: 8 }}>
              <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia,serif' }}>溫馨提示</h3>
              <ul style={{ paddingLeft: 20, color: '#706961', lineHeight: 1.8 }}>
                <li>請於預約時間 5 分鐘前到達工作室。</li>
                <li>如需改期或取消，請最少提前 24 小時通知我們。</li>
                <li>使用套票預約時，取消成功後會自動退還一次；逾期取消請聯絡本店。</li>
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
