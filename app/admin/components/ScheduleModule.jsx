'use client'
import { useEffect, useState } from 'react'
import { adminApi, Feedback, Module, SaveButton, useSave } from './admin-module-ui'

const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const emptyClosure = { startsOn: '', endsOn: '', reason: '' }

export function ScheduleModule() {
  const save = useSave()
  const [hours, setHours] = useState([])
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [closure, setClosure] = useState(emptyClosure)
  async function load() {
    setLoading(true); setLoadError('')
    try {
      const data = await adminApi('/api/admin/schedule')
      setHours(data.hours || []); setBlocks(data.blockedDates || [])
    } catch (error) { setLoadError(error.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const updateHour = (index, patch) => setHours(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row))
  return <Module title="營業時間及休息日期" intro="設定每週開放時間，以及假期或其他臨時休息日期。變更會保留管理記錄。">
    {loading ? <p role="status">載入中…</p> : null}
    {loadError ? <p role="alert">{loadError} <button type="button" onClick={load}>重試</button></p> : null}
    <form onSubmit={async event => {
      event.preventDefault()
      const ok = await save.submit(() => adminApi('/api/admin/schedule', { method: 'POST', body: JSON.stringify({ type: 'hours', hours }) }), '已儲存營業時間。')
      if (ok) await load()
    }}>
      <fieldset disabled={save.pending || loading || Boolean(loadError)}>
        <legend>每週營業時間</legend>
        <div className="hours-grid">{hours.map((row, index) => <div key={row.weekday}>
          <label><input type="checkbox" checked={row.is_open} onChange={event => updateHour(index, { is_open: event.target.checked })}/>星期{weekdays[row.weekday]}開放</label>
          <label>開始<input type="time" disabled={!row.is_open} required={row.is_open} value={row.opens_at?.slice(0, 5) || ''} onChange={event => updateHour(index, { opens_at: event.target.value })}/></label>
          <label>結束<input type="time" disabled={!row.is_open} required={row.is_open} value={row.closes_at?.slice(0, 5) || ''} onChange={event => updateHour(index, { closes_at: event.target.value })}/></label>
        </div>)}</div>
        <button type="button" onClick={() => setHours(rows => rows.map(row => ({ ...row, is_open: false, opens_at: null, closes_at: null })))}>將全部星期設為關閉</button>
        <p>緊急暫停預約：先設為全部關閉，再按儲存。現有預約不會自動取消。</p>
        <SaveButton pending={save.pending} disabled={hours.length !== 7}>儲存營業時間</SaveButton>
      </fieldset>
    </form>
    <form onSubmit={async event => {
      event.preventDefault()
      const ok = await save.submit(() => adminApi('/api/admin/schedule', { method: 'POST', body: JSON.stringify({ type: 'closure', ...closure }) }), '已新增休息日期。')
      if (ok) { setClosure(emptyClosure); await load() }
    }}>
      <fieldset disabled={save.pending || loading || Boolean(loadError)}>
        <legend>臨時休息日期</legend>
        <label>開始日期<input type="date" required value={closure.startsOn} onChange={event => setClosure({ ...closure, startsOn: event.target.value })}/></label>
        <label>結束日期<input type="date" required min={closure.startsOn} value={closure.endsOn} onChange={event => setClosure({ ...closure, endsOn: event.target.value })}/></label>
        <label>原因<input maxLength={240} value={closure.reason} onChange={event => setClosure({ ...closure, reason: event.target.value })}/></label>
        <SaveButton pending={save.pending}>新增休息日期</SaveButton>
      </fieldset>
    </form>
    <Feedback {...save}/>
    <ul>{blocks.map(block => <li key={block.id}>
      {block.starts_on} 至 {block.ends_on} · {block.reason || '休息'}
      <button type="button" disabled={save.pending || loading} onClick={async () => {
        const ok = await save.submit(() => adminApi('/api/admin/schedule?id=' + block.id, { method: 'DELETE' }), '已移除休息日期。')
        if (ok) await load()
      }}>移除休息日期</button>
    </li>)}</ul>
  </Module>
}
