'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function hkDate(d) {
  return new Date(d).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', dateStyle: 'long', timeStyle: 'short' })
}

export default function CancelBookingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [phone, setPhone] = useState('')
  const [appt, setAppt] = useState(null)
  const [apptLoading, setApptLoading] = useState(false)
  const [apptError, setApptError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState(null)
  const [resultError, setResultError] = useState('')

  // Load appointment details
  useEffect(() => {
    if (!id) return
    setApptLoading(true)
    fetch(`/api/appointments/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setApptError(d.error); setAppt(null) }
        else { setAppt(d); setPhone(d.customer_phone || '') }
      })
      .catch(() => setApptError('無法載入預約資料。'))
      .finally(() => setApptLoading(false))
  }, [id])

  const handleCancel = async (e) => {
    e.preventDefault()
    if (!phone.trim()) return
    setConfirming(true)
    setResultError('')
    try {
      const r = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), action: 'cancel' }),
      })
      const d = await r.json()
      if (!r.ok) { setResultError(d.error || '取消失敗，請稍後再試。') }
      else { setResult(d) }
    } catch (_) { setResultError('取消失敗，請稍後再試。') }
    finally { setConfirming(false) }
  }

  if (!id) {
    return (
      <div className="salon">
        <header className="salon-nav"><div className="salon-wrap"><nav><Link href="/">SALON POKE</Link><Link href="/services">服務</Link><Link href="/booking">預約</Link><Link href="/gallery">圖庫</Link><Link href="/about">關於</Link><Link href="/contact">聯絡</Link></nav></div></header>
        <main className="salon-wrap salon-section">
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <h1 style={{ font: '700 32px/1.1 Georgia,serif', marginBottom: 16 }}>無效連結</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>請從預約確認頁面進入取消流程。</p>
            <Link href="/account" className="salon-button">返回帳戶</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="salon">
      <header className="salon-nav"><div className="salon-wrap"><nav><Link href="/">SALON POKE</Link><Link href="/services">服務</Link><Link href="/booking">預約</Link><Link href="/gallery">圖庫</Link><Link href="/about">關於</Link><Link href="/contact">聯絡</Link></nav></div></header>
      <main className="salon-wrap salon-section">
        <div className="confirm-container">

          {result ? (
            <>
              <div className="confirm-icon" style={{ background: '#22c55e' }}>✓</div>
              <h1 className="confirm-title">預約已取消</h1>
              <p className="confirm-subtitle">你的預約 #{id} 已成功取消。如需重新預約，歡迎隨時回來。</p>
              <div className="confirm-actions">
                <Link href="/booking" className="confirm-btn-primary">重新預約</Link>
                <Link href="/" className="confirm-btn-secondary">返回首頁</Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="confirm-title" style={{ fontSize: 28 }}>取消預約</h1>
              <p className="confirm-subtitle">如需取消預約，請輸入預約時的電話號碼以確認身份。</p>

              {apptLoading && <p style={{ color: 'var(--text-muted)' }}>載入中…</p>}
              {apptError && <p style={{ color: 'var(--danger)' }}>{apptError}</p>}

              {appt && (
                <div className="confirm-card" style={{ marginTop: 24, textAlign: 'left' }}>
                  <div className="confirm-row">
                    <span className="confirm-label">參考編號</span>
                    <span className="confirm-value">#{appt.id}</span>
                  </div>
                  <div className="confirm-row">
                    <span className="confirm-label">客戶姓名</span>
                    <span className="confirm-value">{appt.customer_name}</span>
                  </div>
                  <div className="confirm-row">
                    <span className="confirm-label">日期及時間</span>
                    <span className="confirm-value">{hkDate(appt.starts_at)}</span>
                  </div>
                  <div className="confirm-row">
                    <span className="confirm-label">狀態</span>
                    <span className="confirm-value" style={{ textTransform: 'capitalize' }}>{appt.status}</span>
                  </div>
                </div>
              )}

              {appt && ['pending', 'confirmed'].includes(appt.status) && (
                <form onSubmit={handleCancel} style={{ marginTop: 24 }}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
                      電話號碼 *
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="例：91234567"
                      required
                      style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>

                  {resultError && <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{resultError}</p>}

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
                    <Link href="/account" className="confirm-btn-secondary" style={{ padding: '10px 20px' }}>返回</Link>
                    <button
                      type="submit"
                      disabled={confirming || !phone.trim()}
                      style={{ padding: '10px 24px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 15, cursor: confirming ? 'not-allowed' : 'pointer', opacity: confirming ? 0.7 : 1 }}
                    >
                      {confirming ? '取消中…' : '確認取消'}
                    </button>
                  </div>
                </form>
              )}

              {appt && !['pending', 'confirmed'].includes(appt.status) && (
                <div style={{ marginTop: 24, padding: 20, background: 'var(--warning-bg)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                  <p style={{ color: '#b45309', margin: 0 }}>
                    此預約狀態為「{appt.status}」，無法在線上取消。<br />
                    請透過 WhatsApp 聯絡我們處理。
                  </p>
                </div>
              )}

              <div className="confirm-actions" style={{ marginTop: 32 }}>
                <Link href="/account" className="confirm-btn-secondary">返回帳戶</Link>
                <Link href="/" className="confirm-btn-secondary">返回首頁</Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
