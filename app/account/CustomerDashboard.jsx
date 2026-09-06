'use client'
import { useState } from 'react'
import Link from 'next/link'

function balanceColor(r, t) {
  if (!t || r === 0) return '#c0392b'
  if (r <= Math.ceil(t * 0.25)) return '#e67e22'
  return '#27ae60'
}
function statusLabel(s) {
  const map = { pending: '待確認', confirmed: '已確認', completed: '已完成', cancelled: '已取消', no_show: '無故缺席' }
  return map[s] || s
}
function statusClass(s) {
  const m = { pending: 'appt-tag', confirmed: 'appt-tag', completed: 'appt-tag', cancelled: 'appt-tag', no_show: 'appt-tag' }
  return m[s] || 'appt-tag'
}
function hkDate(d) {
  return new Date(d).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium', timeStyle: 'short' })
}

export default function CustomerDashboard({ whatsapp }) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const lookup = async (e) => {
    e.preventDefault()
    if (!phone.trim()) return
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`/api/customers?phone=${encodeURIComponent(phone.trim())}`)
      const d = await r.json()
      if (!d.customers?.length) { setData(null); setError('找不到此電話號碼的記錄'); return }
      setData(d.customers[0])
    } catch (_) { setError('查詢失敗，請稍後再試。') }
    finally { setLoading(false) }
  }

  const now = new Date()
  const upcoming = data?.customer_packages || []
  const pastThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  return (
    <div>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ font: '700 36px/1.1 Georgia,serif', marginBottom: 8 }}>我的帳戶</h1>
        <p style={{ color: '#706961', marginBottom: 32 }}>輸入你的電話號碼，查看預約及套票記錄。</p>
      </header>

      <div className="dashboard-phone-lookup">
        <form className="dashboard-phone-form" onSubmit={lookup}>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="例：91234567"
            required
          />
          <button type="submit" className="salon-button" disabled={loading}>
            {loading ? '搜尋中…' : '查詢'}
          </button>
        </form>
        {error && <p style={{ color: '#ef4444', fontSize: 14, marginTop: 10 }}>{error}</p>}
      </div>

      {data && (
        <>
          {/* Customer info */}
          <div style={{ marginBottom: 36, padding: '20px 24px', background: 'var(--cream)', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--border)' }}>
            <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>👤 {data.name}</p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>{data.phone} {data.email ? `· ${data.email}` : ''}</p>
          </div>

          {/* Packages */}
          <div className="dashboard-section">
            <div className="dashboard-section-header">
              <span style={{ fontSize: 20 }}>🎫</span>
              <h2>我的套票</h2>
            </div>
            {!data.customer_packages?.length ? (
              <div className="empty-state">
                <p>暫無套票記錄。</p>
                <Link href="/packages" className="salon-button" style={{ marginTop: 12, display: 'inline-block' }}>瀏覽套票</Link>
              </div>
            ) : (
              data.customer_packages.map(cp => {
                const ratio = cp.sessions_remaining / cp.total_sessions
                const isExpiringSoon = new Date(cp.expires_at) <= new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
                const isExhausted = cp.sessions_remaining === 0 || !cp.is_active
                const cls = isExhausted ? 'exhausted' : isExpiringSoon ? 'expiring-soon' : ''
                return (
                  <div key={cp.id} className={`package-card-mini ${cls}`}
                    style={{ borderLeftColor: cp.packages?.colour_hex || 'var(--gold)' }}>
                    <div className="package-card-mini-info">
                      <strong>{cp.packages?.name || '套票'}</strong>
                      <p>
                        <span style={{ color: balanceColor(cp.sessions_remaining, cp.total_sessions), fontWeight: 700 }}>
                          {cp.sessions_remaining} / {cp.total_sessions} 次
                        </span>
                        {' '}可用 · 到期：{new Date(cp.expires_at).toLocaleDateString('zh-HK')}
                        {!cp.is_active && <span style={{ color: '#c0392b' }}>（已停用）</span>}
                      </p>
                    </div>
                    <div className="package-balance-bar">
                      <div className="package-balance-fill" style={{
                        width: `${Math.max(0, ratio * 100)}%`,
                        background: balanceColor(cp.sessions_remaining, cp.total_sessions)
                      }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* CTA */}
          <div style={{ marginBottom: 40 }}>
            <Link href="/booking" className="salon-button">立即預約</Link>
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp.replace(/^\+?852/, '852')}`}
                target="_blank" rel="noopener noreferrer"
                className="salon-button" style={{ marginLeft: 10, background: '#25D366' }}>
                WhatsApp 查詢
              </a>
            )}
          </div>

          {/* Contact card */}
          <div style={{ padding: 24, background: 'var(--cream)', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia,serif' }}>聯絡我們</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>如有任何關於套票或預約的問題，歡迎聯絡我們。</p>
            <a className="salon-button" href={`https://wa.me/${whatsapp?.replace(/^\+?852/, '852') || '852XXXXXXXX'}`} target="_blank" rel="noopener">WhatsApp 查詢</a>
          </div>
        </>
      )}

      {!data && !error && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-light)' }}>
          <p style={{ fontSize: 15 }}>輸入你的電話號碼以查詢預約記錄及套票。</p>
        </div>
      )}
    </div>
  )
}
