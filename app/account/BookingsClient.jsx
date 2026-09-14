'use client'
import { useEffect, useReducer, useState } from 'react'
import { useRouter } from 'next/navigation'
import { accountBookingsReducer } from './account-booking-state'
import { submitAccountReschedule } from './reschedule-submission'

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

/** Client-side account list. Mutations preserve the rendered old slot until the server command succeeds. */
export default function BookingsClient({ initialBookings = [] }) {
  const router = useRouter()
  const [items, dispatch] = useReducer(accountBookingsReducer, initialBookings)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => { dispatch({ type: 'SERVER_REFRESH', bookings: initialBookings }) }, [initialBookings])

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
      dispatch({ type: 'BOOKING_UPDATED', booking: body.booking })
      setMessage(body.packageRefunded ? '已取消，套票次數已退還。' : '已取消。')
      router.refresh()
    } catch (caught) { setError(caught.message) } finally { setBusyId(null) }
  }

  const reschedule = async (booking) => {
    const input = prompt('輸入新嘅日期時間 (YYYY-MM-DDTHH:mm，香港時間):', hongKongInputDateTime(booking.startsAt))
    if (!input) return
    const match = input.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/)
    if (!match) { setError('日期時間格式唔啱，請用 YYYY-MM-DDTHH:mm。'); return }
    setBusyId(booking.id); setError(''); setMessage('')
    try {
      // Only the atomic command can decide availability while retaining the
      // old slot. A public preflight cannot exclude this appointment itself.
      const result = await submitAccountReschedule({
        fetcher: fetch, bookingId: booking.id, date: match[1], time: match[2], staffPreference: booking.staffId || 'any',
      })
      if (!result.ok) {
        if (result.status === 409) throw new Error(`${result.error} 原有預約仍然保留。`)
        throw new Error(result.error)
      }
      dispatch({ type: 'BOOKING_UPDATED', booking: result.booking })
      setMessage('已成功改期。')
      router.refresh()
    } catch (caught) { setError(caught.message) } finally { setBusyId(null) }
  }

  if (!items.length) return <p className="present-a0160dd3">暫時沒有預約記錄。</p>

  return (
    <>
      {error ? <div className="form-error present-4933c088"  role="alert">⚠️ {error}</div> : null}
      {message ? <div className="form-success present-4933c088"  role="status">✓ {message}</div> : null}
      <div className="admin-list">
        {items.map((booking) => {
          const active = !['cancelled', 'completed', 'no_show'].includes(booking.status)
          const redemption = booking.packageRedemption
          return (
            <article key={booking.id} aria-label={`預約 ${booking.reference || booking.id}`}>
              <div>
                <strong>{booking.service?.name || `預約 ${booking.reference || `#${booking.id}`}`}</strong>
                <p>{bookingTime(booking.startsAt)}</p>
                <p className="present-37320b7c">服務員工：{booking.staff?.displayName || '待安排'}</p>
                {redemption ? <p className="present-37320b7c">
                  套票：{redemption.packageName || `#${redemption.packageId}`} · {redemption.refundedAt ? '已退還' : '已扣減'} · 剩餘 {redemption.sessionsRemaining ?? '—'}/{redemption.totalSessions ?? '—'} 次
                </p> : null}
              </div>
              <div className="present-2b8fc28b">
                <span className={`status ${booking.status || 'pending'}`}>{booking.status || 'pending'}</span>
                {active ? <div className="present-3633e433">
                  <button type="button" className="admin-action" disabled={busyId === booking.id} onClick={() => reschedule(booking)}>改期</button>
                  <button type="button" className="admin-action present-a15c82f6"  disabled={busyId === booking.id} onClick={() => cancel(booking.id)}>取消</button>
                </div> : null}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
