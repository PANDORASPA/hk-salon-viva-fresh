'use client'

import { useEffect, useMemo, useState } from 'react'

const hkDay = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(new Date(`${value}T00:00:00+08:00`).getTime())
const addDays = (day, days) => { const next = new Date(`${validDay(day) ? day : hkDay(new Date())}T00:00:00+08:00`); next.setUTCDate(next.getUTCDate() + days); return hkDay(next) }
const label = value => new Date(value).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
const toInput = value => { const date = new Date(value); return `${hkDay(date)}T${date.toLocaleTimeString('en-GB', { timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hour12: false })}` }
const asHkIso = value => value ? `${value}:00+08:00` : ''
const statuses = [['', '所有狀態'], ['pending', '待確認'], ['confirmed', '已確認'], ['completed', '已完成'], ['cancelled', '已取消'], ['no_show', '未出席']]

export default function BookingCalendar() {
  const [mode, setMode] = useState('day'), [day, setDay] = useState(() => hkDay(new Date()))
  const [staff, setStaff] = useState([]), [services, setServices] = useState([]), [rows, setRows] = useState([])
  const [staffFilter, setStaffFilter] = useState(''), [statusFilter, setStatusFilter] = useState(''), [serviceFilter, setServiceFilter] = useState('')
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [showCreate, setShowCreate] = useState(false)
  const endDay = useMemo(() => addDays(day, mode === 'week' ? 6 : 0), [day, mode])
  const load = async () => {
    setLoading(true); setError('')
    try {
      const filters = new URLSearchParams({ from: day, to: endDay })
      if (staffFilter) filters.set('staffId', staffFilter)
      if (statusFilter) filters.set('status', statusFilter)
      if (serviceFilter) filters.set('serviceId', serviceFilter)
      const [appointments, operations] = await Promise.all([fetch(`/api/admin/appointments?${filters}`), fetch('/api/admin/operations')])
      const [appointmentData, operationData] = await Promise.all([appointments.json().catch(() => ({})), operations.json().catch(() => ({}))])
      if (!appointments.ok) throw new Error(appointmentData.error || '未能載入預約。')
      if (!operations.ok) throw new Error(operationData.error || '未能載入篩選資料。')
      setRows(appointmentData.appointments || []); setStaff(operationData.staff || []); setServices(operationData.services || [])
    } catch (cause) { setError(cause.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [day, endDay, staffFilter, statusFilter, serviceFilter])
  const save = async (event, method) => {
    event.preventDefault(); setError('')
    const formNode = event.currentTarget; const form = Object.fromEntries(new FormData(formNode));
    const payload = { ...form, id: form.id ? Number(form.id) : undefined, serviceId: form.serviceId ? Number(form.serviceId) : undefined, staffPreference: form.staffPreference || 'any', startsAt: asHkIso(form.startsAt) }
    try {
      const response = await fetch('/api/admin/appointments', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || '未能儲存預約。')
      formNode.reset(); setShowCreate(false); load()
    } catch (cause) { setError(cause.message) }
  }
  const changeStatus = async (id, status) => {
    setError('')
    try { const response = await fetch('/api/admin/appointments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || '未能更新狀態。'); load() } catch (cause) { setError(cause.message) }
  }
  return (
    <section className="admin-module" aria-labelledby="calendar-title">
      <header><h2 id="calendar-title">預約日曆</h2><p>以香港時間安排、查看及改期；所有時間變更會重新檢查可用時段。</p></header>
      <div className="admin-calendar-controls">
        <div role="group" aria-label="日曆檢視"><button className={`admin-action ${mode === 'day' ? 'active' : ''}`} onClick={() => setMode('day')}>日</button><button className={`admin-action ${mode === 'week' ? 'active' : ''}`} onClick={() => setMode('week')}>週</button></div>
        <button className="admin-action" onClick={() => setDay(current => addDays(current, mode === 'week' ? -7 : -1))}>上一個</button><label>日期<input type="date" value={day} onChange={event => setDay(validDay(event.target.value) ? event.target.value : hkDay(new Date()))} /></label><button className="admin-action" onClick={() => setDay(current => addDays(current, mode === 'week' ? 7 : 1))}>下一個</button>
        <select aria-label="篩選員工" value={staffFilter} onChange={event => setStaffFilter(event.target.value)}><option value="">所有員工</option>{staff.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
        <select aria-label="篩選狀態" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>{statuses.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
        <select aria-label="篩選服務" value={serviceFilter} onChange={event => setServiceFilter(event.target.value)}><option value="">所有服務</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
        <button className="admin-action" onClick={() => setShowCreate(open => !open)}>{showCreate ? '關閉新增' : '新增預約'}</button>
      </div>
      {showCreate ? <form className="admin-create-booking" onSubmit={event => save(event, 'POST')}><label>服務<select name="serviceId" required><option value="">選擇服務</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><label>員工<select name="staffPreference"><option value="any">自動安排</option>{staff.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>時間<input name="startsAt" type="datetime-local" required /></label><label>客戶姓名<input name="customerName" required /></label><label>電話<input name="customerPhone" required /></label><button className="admin-action">建立預約</button></form> : null}
      {error ? <p role="alert" className="salon-error">{error}</p> : null}
      {loading ? <p aria-busy="true">正在載入預約…</p> : rows.length ? <div className="admin-calendar-table"><table><caption>{mode === 'week' ? `${day} 至 ${endDay}` : day}</caption><thead><tr><th>時間</th><th>客戶</th><th>服務</th><th>員工</th><th>狀態</th><th>操作</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{label(row.startsAt)}</td><td>{row.customerName}<small>{row.customerPhone}</small></td><td>{row.serviceName}</td><td>{row.staffName}</td><td><span className={`status ${row.status}`}>{statuses.find(([value]) => value === row.status)?.[1] || row.status}</span></td><td><details><summary>改期及狀態</summary><form onSubmit={event => save(event, 'PATCH')}><input type="hidden" name="id" value={row.id} /><label>新時間<input name="startsAt" type="datetime-local" defaultValue={toInput(row.startsAt)} required /></label><label>安排員工<select aria-label="改期安排員工" name="staffPreference" defaultValue={String(row.staffId || 'any')}><option value="any">自動安排</option>{staff.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><button className="admin-action">儲存改期</button></form>{row.status === 'pending' ? <div><button className="admin-action" onClick={() => changeStatus(row.id, 'confirmed')}>確認</button></div> : null}{['pending','confirmed'].includes(row.status) ? <div><button className="admin-action" onClick={() => changeStatus(row.id, 'cancelled')}>取消</button>{row.status === 'confirmed' ? <button className="admin-action" onClick={() => changeStatus(row.id, 'completed')}>完成</button> : null}<button className="admin-action" onClick={() => changeStatus(row.id, 'no_show')}>未出席</button></div> : null}</details></td></tr>)}</tbody></table></div> : <p className="admin-empty">這段時間沒有符合篩選的預約。</p>}
    </section>
  )
}
