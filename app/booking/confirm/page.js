import { getServerClient } from '../../../lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata = { title: '預約確認 | SALON POKE BY VIVA' }

function statusLabel(s) {
  const map = { pending: '待確認', confirmed: '已確認', completed: '已完成', cancelled: '已取消', no_show: '無故缺席' }
  return map[s] || s
}
function statusClass(s) {
  const map = { pending: 'status-pending', confirmed: 'status-confirmed', completed: 'status-completed', cancelled: 'status-cancelled', no_show: 'status-no_show' }
  return `status-badge ${map[s] || 'status-pending'}`
}

export default async function BookingConfirmPage({ searchParams }) {
  const params = await searchParams
  const db = await getServerClient()

  let appointment = null
  let service = null
  let packageName = null

  if (params.id) {
    const { data } = await db
      .from('appointments')
      .select('*, customer_packages(packages(name)))')
      .eq('id', Number(params.id))
      .maybeSingle()
    appointment = data
    if (appointment) {
      const { data: svc } = await db.from('services').select('name,duration_minutes,price').eq('id', appointment.service_id).maybeSingle()
      service = svc
      packageName = appointment.customer_packages?.packages?.name || null
    }
  }

  const hk = (d) => new Date(d).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', dateStyle: 'long', timeStyle: 'short' })

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
        {appointment ? (
          <div className="confirm-container">
            <div className="confirm-icon">✓</div>
            <h1 className="confirm-title">預約已提交！</h1>
            <p className="confirm-subtitle">感謝你的預約。我們會透過 WhatsApp 確認你的預約時間。</p>

            <div className="confirm-card">
              <div className="confirm-row">
                <span className="confirm-label">參考編號</span>
                <span className="confirm-value">#{appointment.id}</span>
              </div>
              <div className="confirm-row">
                <span className="confirm-label">服務</span>
                <span className="confirm-value">{service?.name || '—'}</span>
              </div>
              <div className="confirm-row">
                <span className="confirm-label">日期及時間</span>
                <span className="confirm-value">{hk(appointment.starts_at)}</span>
              </div>
              <div className="confirm-row">
                <span className="confirm-label">客戶姓名</span>
                <span className="confirm-value">{appointment.customer_name}</span>
              </div>
              <div className="confirm-row">
                <span className="confirm-label">聯絡電話</span>
                <span className="confirm-value">{appointment.customer_phone}</span>
              </div>
              {appointment.customer_email && (
                <div className="confirm-row">
                  <span className="confirm-label">電郵</span>
                  <span className="confirm-value">{appointment.customer_email}</span>
                </div>
              )}
              <div className="confirm-row">
                <span className="confirm-label">套票</span>
                <span className="confirm-value">{packageName || '自費付款'}</span>
              </div>
              <div className="confirm-row">
                <span className="confirm-label">狀態</span>
                <span className={statusClass(appointment.status)}>{statusLabel(appointment.status)}</span>
              </div>
            </div>

            <div className="confirm-actions">
              <Link href="/booking" className="confirm-btn-secondary">新增預約</Link>
              <Link href="/" className="confirm-btn-primary">返回首頁</Link>
            </div>
          </div>
        ) : (
          <div className="confirm-container">
            <h1 className="confirm-title">找不到預約記錄</h1>
            <p className="confirm-subtitle">請聯絡我們查詢。</p>
            <div className="confirm-actions">
              <Link href="/booking" className="confirm-btn-primary">前往預約</Link>
              <Link href="/" className="confirm-btn-secondary">返回首頁</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
