'use client'

import { useEffect, useRef, useState } from 'react'

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const defaults = () => Array.from({ length: 7 }, (_, weekday) => ({ weekday, isWorking: weekday !== 0, startsAt: weekday === 0 ? null : '10:00', endsAt: weekday === 0 ? null : '19:00' }))

export default function StaffHoursEditor({ staffId }) {
  const [hours, setHours] = useState(defaults), [loading, setLoading] = useState(true), [message, setMessage] = useState(''), [error, setError] = useState('')
  const generation = useRef(0)
  const load = async () => {
    const current = ++generation.current; setLoading(true); setError('')
    try { const response = await fetch(`/api/admin/staff/${staffId}/hours`); const data = await response.json(); if (!response.ok) throw new Error(data.error || '未能載入工時。'); if (current === generation.current) setHours(data.hours?.length === 7 ? data.hours : defaults()) }
    catch (cause) { if (current === generation.current) setError(cause.message) } finally { if (current === generation.current) setLoading(false) }
  }
  useEffect(() => { load(); return () => { generation.current += 1 } }, [staffId])
  const update = (weekday, patch) => setHours(rows => rows.map(row => row.weekday === weekday ? { ...row, ...patch } : row))
  const save = async () => {
    setError(''); setMessage('')
    try { const response = await fetch(`/api/admin/staff/${staffId}/hours`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hours }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || '未能儲存工時。'); setMessage('已儲存每週工時。') }
    catch (cause) { setError(cause.message) }
  }
  return <section className="staff-editor"><h3>每週工時</h3>{loading ? <p aria-busy="true">正在載入工時…</p> : <div className="staff-hours">{hours.map(row => <label key={row.weekday}><span>{weekdays[row.weekday]}</span><input aria-label={`${weekdays[row.weekday]} 上班`} type="checkbox" checked={row.isWorking} onChange={event => update(row.weekday, { isWorking: event.target.checked, startsAt: event.target.checked ? row.startsAt || '10:00' : null, endsAt: event.target.checked ? row.endsAt || '19:00' : null })} /><input aria-label={`${weekdays[row.weekday]} 開始`} type="time" disabled={!row.isWorking} value={row.startsAt || ''} onChange={event => update(row.weekday, { startsAt: event.target.value })} /><input aria-label={`${weekdays[row.weekday]} 結束`} type="time" disabled={!row.isWorking} value={row.endsAt || ''} onChange={event => update(row.weekday, { endsAt: event.target.value })} /></label>)}</div>}{error ? <p role="alert" className="salon-error">{error}</p> : null}{message ? <p className="admin-success">{message}</p> : null}<button className="admin-action" disabled={loading || Boolean(error)} onClick={save}>儲存工時</button></section>
}
