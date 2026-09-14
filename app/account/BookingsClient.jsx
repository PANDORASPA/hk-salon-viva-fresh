'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

function hongKongInputDateTime(startsAt) {
  if (!startsAt) return ''
  const date = new Date(startsAt)
  return `${date.toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' })}T${date.toLocaleTimeString('en-GB', { timeZone: 'Asia/Hong_Kong', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' })}`
}

function bookingTime(startsAt) {
  return startsAt ? new Date(startsAt).toLocaleString('zh-HK', {
    timeZone: 'Asia/Hong_Kong', dateStyle: 'long', timeStyle: 'short',
  }) : '時間待確認'
}

async function availableSlot({ date, serviceId, staffId, startsAt }) {
  if (!serviceId) return { staffPreference: staffId || 'any' }
  const response = await fetch(`/api/availability?date=${encodeURIComponent(date)}&serviceId=${encodeURIComponent(serviceId)}&staffId=${encodeURIComponent(staffId || 'any')}`)
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || '暫時無法載入可預約時段。')
  const slot = body.slots?.find((item) => item.iso === startsAt)
  if (!slot) throw new Error('你選擇的時段已不可預約；原有預約仍然保留。')
  return { staffPreference: slot.staffIds?.includes(staffId) ? staffId : 'any' }
}

/** Client-side account list. Mutations preserve the rendered old slot until the server command succeeds. */
export default function BookingsClient({ initialBookings = [] }) {
  const router = useRouter()
  const [items, setItems] = useState(initialBookings)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const cancel = async (id) => {
    if (!confirm('確定取消呢個預約？如符合取消期限，使用套票的次數會自動退還。')) return
    setBusyId(id); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/account/bookings/${id}`, { method: 'DELETE' })
      const body = await response.json()
      if (!response.ok) {
        if (body.code === 'late_cancellation') {
          throw new Error(`太遲取消：需最少 ${body.cutoffHours} 小時前通知，呢個預約只餘 ${body.hoursUntilStart ?? '?'} 小時。請 WhatsApp 我哋處理。`)
        }
        throw new Error(body.error || '取消失敗')
      }
      setItems((previous) => previous.map((booking) => booking.id === id ? body.booking : booking))
      setMessage(body.packageRefunded ? '已取消，套票次數已退還。' : '已取消。')
      router.refresh()
    } catch (caught) { setError(caught.message) } finally { setBusyId(null) }
  }

  const reschedule = async (booking) => {
    const input = prompt('輸入新嘅日期時間 (YYYY-MM-DDTHH:mm，香港時間):', hongKongInputDateTime(booking.startsAt))
    if (!input) return
    const match = input.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/)
    if (!match) { setError('日期時間格式唔啱，請用 YYYY-MM-DDTHH:mm。'); return }
    const startsAt = `${match[1]}T${match[2]}:00+08:00`
    setBusyId(booking.id); setError(''); setMessage('')
    try {
      // The public availability endpoint is advisory only. The atomic server
      // command remains authoritative and keeps this old booking on a 409.
      const { staffPreference } = await availableSlot({
        date: match[1], serviceId: booking.serviceId, staffId: booking.staffId, startsAt,
      })
      const response = await fetch(`/api/account/bookings/${booking.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: match[1], time: match[2], staffPreference }),
      })
      const body = await response.json()
      if (!response.ok) {
        if (response.status === 409) throw new Error(`${body.error || '改期失敗'} 原有預約仍然保留。`)
        throw new Error(body.error || '改期失敗')
      }
      setItems((previous) => previous.map((item) => item.id === booking.id ? body.booking : item))
      setMessage('已成功改期。')
      router.refresh()
    } catch (caught) { setError(caught.message) } finally { setBusyId(null) }
  }

  if (!items.length) return <p style={{ color: '#928a81', marginBottom: 40 }}>暫時沒有預約記錄。</p>

  return (
    <>
      {error ? <div className="form-error" style={{ marginBottom: 16 }} role="alert">⚠️ {error}</div> : null}
      {message ? <div className="form-success" style={{ marginBottom: 16 }} role="status">✓ {message}</div> : null}
      <div className="admin-list">
        {items.map((booking) => {
          const active = !['cancelled', 'completed', 'no_show'].includes(booking.status)
          const redemption = booking.packageRedemption
          return (
            <article key={booking.id}>
              <div>
                <strong>{booking.service?.name || `預約 ${booking.reference || `#${booking.id}`}`}</strong>
                <p>{bookingTime(booking.startsAt)}</p>
                <p style={{ fontSize: 12, color: '#706961', marginTop: 4 }}>服務員工：{booking.staff?.displayName || '待安排'}</p>
                {redemption ? <p style={{ fontSize: 12, color: '#706961', marginTop: 4 }}>
                  套票：{redemption.packageName || `#${redemption.packageId}`} · {redemption.refundedAt ? '已退還' : '已扣減'} · 剩餘 {redemption.sessionsRemaining ?? '—'}/{redemption.totalSessions ?? '—'} 次
                </p> : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <span className={`status ${booking.status || 'pending'}`}>{booking.status || 'pending'}</span>
                {active ? <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="admin-action" disabled={busyId === booking.id} onClick={() => reschedule(booking)}>改期</button>
                  <button type="button" className="admin-action" style={{ color: '#c0392b' }} disabled={busyId === booking.id} onClick={() => cancel(booking.id)}>取消</button>
                </div> : null}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
