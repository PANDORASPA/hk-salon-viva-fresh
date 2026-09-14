import Link from 'next/link'
import { getServerClient } from '../../../lib/supabase/server.js'
import { getServiceClient } from '../../../lib/supabase/service.js'
import { loadConfirmationAppointment, confirmationPayment } from '../../../lib/booking/confirmation.js'
import { formatAppointmentDateTime, formatPriceHkd } from '../../../lib/format.js'
import { publicContact } from '../../../lib/content/public-contact.js'

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
  let contact = publicContact()
  try {
    const { data } = await db.from('site_content').select('data').eq('id', 1).maybeSingle()
    contact = publicContact(data?.data?.contact)
  } catch {}

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
  const payment = confirmationPayment(appointment)
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
        <h1 className="salon-section-title present-82d03763" >
          {appointment ? '預約已確認' : '查詢預約'}
        </h1>

        {error && <div className="form-error" role="alert">{error}</div>}

        {!error && !appointment && (
          <p className="present-741dd0c5">
            {id ? '預約連結無效或已失效。請登入帳戶查看你的預約，或使用確認電郵中的專屬連結。' : '沒有提供有效的預約連結。'}
          </p>
        )}

        {appointment && (
          <>
            <p className="present-1d3782f8">
              ✓ 我們已收到你的預約申請，我們會盡快透過 WhatsApp 或致電確認。
            </p>
            <div className="admin-list present-e8a8a9c0" >
              <article>
                <div><strong>預約編號</strong><p>{appointment.reference || `#${appointment.id}`}</p></div>
                <span className={`status ${appointment.status || 'pending'}`}>{appointment.status || 'pending'}</span>
              </article>
              <article>
                <div><strong>服務</strong><p>{appointment.services?.name || '—'}</p></div>
                <span className="present-741dd0c5">{appointment.services?.duration_minutes ? `${appointment.services.duration_minutes} 分鐘` : ''}</span>
              </article>
              <article>
                <div><strong>服務員工</strong><p>{appointment.staff?.display_name || '待安排'}</p></div>
                <span className="present-741dd0c5">已安排員工</span>
              </article>
              <article>
                <div><strong>時間</strong><p>{startsAt || '待確認'}</p></div>
                <span className="present-741dd0c5">香港時間 (Asia/Hong_Kong)</span>
              </article>
              {payment && (
                <article>
                  <div><strong>費用</strong><p>{payment.method === 'package' ? payment.label : priceHkd == null ? '按預約服務收費' : `HK$ ${priceHkd}`}</p></div>
                  <span className="present-741dd0c5">{payment.method === 'package' ? '套票預約' : payment.label}</span>
                </article>
              )}
            </div>

            <div className="present-bee85b65">
              {contact.whatsappHref ? <a className="salon-button" href={`${contact.whatsappHref}?text=${encodeURIComponent(`你好！我剛在 SALON POKE 網站預約了 ${appointment.reference || `#${appointment.id}`}（${appointment.services?.name || ''}，${startsAt || ''}），請確認。`)}`} target="_blank" rel="noopener">WhatsApp 確認</a> : null}
              <a className="salon-button salon-button-secondary" href={calendarHref}>加入日曆 (.ics)</a>
              <Link className="salon-button salon-button-secondary" href="/">返回首頁</Link>
            </div>

            <div className="present-60755ad6">
              <h3 className="present-e68a0e44">溫馨提示</h3>
              <ul className="present-b4e92141">
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
