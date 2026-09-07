'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Client-side list of the signed-in member's bookings with cancel + reschedule
 * actions. The server component (`app/account/page.js`) loads the data, then
 * passes the array down to this client component for interaction.
 */
export default function BookingsClient({ initialBookings = [] }) {
  const router = useRouter()
  const [items, setItems] = useState(initialBookings)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const cancel = async (id) => {
    if (!confirm('確定取消呢個預約？如使用套票，次數會自動退還。')) return
    setBusyId(id)
    setError('')
    setMessage('')
    try {
      const r = await fetch(`/api/account/bookings/${id}`, { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok) {
        if (d.code === 'late_cancellation') {
          const hours = d.hoursUntilStart ?? '?'
          throw new Error(`太遲取消：需最少 ${d.cutoffHours} 小時前通知，呢個預約只餘 ${hours} 小時。請 WhatsApp 我哋處理。`)
        }
        throw new Error(d.error || '取消失敗')
      }
      setItems((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)))
      setMessage(d.packageRefunded ? '已取消，套票次數已退還。' : '已取消。')
      router.refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const reschedule = async (b) => {
    const input = prompt(
      '輸入新嘅日期時間 (YYYY-MM-DDTHH:mm，香港時間):',
      b.starts_at ? b.starts_at.slice(0, 16) : '',
    )
    if (!input) return
    setBusyId(b.id)
    setError('')
    setMessage('')
    try {
      const r = await fetch(`/api/account/bookings/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startsAt: input }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || '改期失敗')
      setItems((prev) => prev.map((x) => (x.id === b.id ? { ...x, ...d.booking } : x)))
      setMessage('已成功改期。')
      router.refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  if (!items.length) {
    return <p style={{ color: '#928a81', marginBottom: 40 }}>暫時沒有預約記錄。</p>
  }

  return (
    <>
      {error && (
        <div className="form-error" style={{ marginBottom: 16 }} role="alert">⚠️ {error}</div>
      )}
      {message && (
        <div className="form-success" style={{ marginBottom: 16 }} role="status">✓ {message}</div>
      )}
      <div className="admin-list">
        {items.map((b) => {
          const isActive = b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'no_show'
          return (
            <article key={b.id}>
              <div>
                <strong>{b.services?.name || `預約 #${b.id}`}</strong>
                <p>
                  {b.starts_at
                    ? new Date(b.starts_at).toLocaleString('zh-HK', {
                        timeZone: 'Asia/Hong_Kong',
                        dateStyle: 'long',
                        timeStyle: 'short',
                      })
                    : '時間待確認'}
                </p>
                {b.customer_package_id && (
                  <p style={{ fontSize: 12, color: '#706961', marginTop: 4 }}>
                    使用套票 #{b.customer_package_id}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <span className={`status ${b.status || 'pending'}`}>{b.status || 'pending'}</span>
                {isActive && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="admin-action"
                      disabled={busyId === b.id}
                      onClick={() => reschedule(b)}
                    >
                      改期
                    </button>
                    <button
                      type="button"
                      className="admin-action"
                      style={{ color: '#c0392b' }}
                      disabled={busyId === b.id}
                      onClick={() => cancel(b.id)}
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
