'use client'

import { useEffect, useRef, useState } from 'react'

const format = value => new Date(value).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
const iso = value => value ? `${value}:00+08:00` : ''

export default function TimeOffEditor({ staffId }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const generation = useRef(0)
  const load = async () => { const current = ++generation.current; setLoading(true); setError(''); try { const response = await fetch(`/api/admin/staff/${staffId}/time-off`); const data = await response.json(); if (!response.ok) throw new Error(data.error || '未能載入休假。'); if (current === generation.current) setRows(data.timeOff || []) } catch (cause) { if (current === generation.current) setError(cause.message) } finally { if (current === generation.current) setLoading(false) } }
  useEffect(() => { load(); return () => { generation.current += 1 } }, [staffId])
  const create = async event => { event.preventDefault(); setError(''); const formNode = event.currentTarget; const form = Object.fromEntries(new FormData(formNode)); try { const response = await fetch(`/api/admin/staff/${staffId}/time-off`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startsAt: iso(form.startsAt), endsAt: iso(form.endsAt), reason: form.reason }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || '未能新增休假。'); formNode.reset(); load() } catch (cause) { setError(cause.message) } }
  const remove = async id => { setError(''); try { const response = await fetch(`/api/admin/staff/${staffId}/time-off?id=${id}`, { method: 'DELETE' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || '未能移除休假。'); load() } catch (cause) { setError(cause.message) } }
  return <section className="staff-editor"><h3>休假及不可預約時間</h3><form className="time-off-form" onSubmit={create}><label>開始<input name="startsAt" type="datetime-local" required /></label><label>結束<input name="endsAt" type="datetime-local" required /></label><label>原因<input name="reason" maxLength="300" placeholder="例：培訓" /></label><button className="admin-action">新增</button></form>{error ? <p role="alert" className="salon-error">{error}</p> : null}{loading ? <p aria-busy="true">正在載入休假…</p> : rows.length ? <ul className="time-off-list">{rows.map(row => <li key={row.id}><span>{format(row.startsAt)} – {format(row.endsAt)} {row.reason ? `· ${row.reason}` : ''}</span><button className="admin-action" onClick={() => remove(row.id)}>移除</button></li>)}</ul> : <p className="admin-empty">暫無休假紀錄。</p>}</section>
}
