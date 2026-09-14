'use client'

import { useEffect, useRef, useState } from 'react'
import { createInitialStaffHoursState, createStaffHoursController } from './staff-hours-controller.js'

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export default function StaffHoursEditor({ staffId }) {
  const [view, setView] = useState(createInitialStaffHoursState)
  const controller = useRef(null)
  if (!controller.current) controller.current = createStaffHoursController({ onStateChange: setView })

  useEffect(() => {
    const activeController = controller.current
    void activeController.load(staffId)
    return () => activeController.cancel()
  }, [staffId])

  const update = (weekday, patch) => controller.current.update(weekday, patch)
  const save = () => controller.current.save(staffId)

  return <section className="staff-editor"><h3>每週工時</h3>{view.loading ? <p aria-busy="true">正在載入工時…</p> : <div className="staff-hours">{view.hours.map(row => <label key={row.weekday}><span>{weekdays[row.weekday]}</span><input aria-label={`${weekdays[row.weekday]} 上班`} type="checkbox" checked={row.isWorking} onChange={event => update(row.weekday, { isWorking: event.target.checked, startsAt: event.target.checked ? row.startsAt || '10:00' : null, endsAt: event.target.checked ? row.endsAt || '19:00' : null })} /><input aria-label={`${weekdays[row.weekday]} 開始`} type="time" disabled={!row.isWorking} value={row.startsAt || ''} onChange={event => update(row.weekday, { startsAt: event.target.value })} /><input aria-label={`${weekdays[row.weekday]} 結束`} type="time" disabled={!row.isWorking} value={row.endsAt || ''} onChange={event => update(row.weekday, { endsAt: event.target.value })} /></label>)}</div>}{view.loadError ? <p role="alert" className="salon-error">{view.loadError}</p> : null}{view.saveError ? <p role="alert" className="salon-error">{view.saveError}</p> : null}{view.message ? <p className="admin-success">{view.message}</p> : null}<button className="admin-action" disabled={!view.canSave} onClick={save}>儲存工時</button></section>
}
