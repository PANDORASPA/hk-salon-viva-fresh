'use client'

import { useEffect, useState } from 'react'

const hkDate = value => new Date(`${value}T00:00:00+08:00`).toLocaleDateString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'long', day: 'numeric', weekday: 'short' })
const time = value => new Date(value).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

export default function DashboardModule() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = async () => {
    setError('')
    try {
      const response = await fetch('/api/admin/operations')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || '未能載入營運資料。')
      setData(payload)
    } catch (cause) { setError(cause.message) }
  }
  useEffect(() => { load() }, [])
  if (error) return <section className="admin-module"><h2>營運總覽</h2><p role="alert" className="salon-error">{error}</p><button className="admin-action" onClick={load}>重新載入</button></section>
  if (!data) return <section className="admin-module" aria-busy="true"><h2>營運總覽</h2><p>正在載入今日資料…</p></section>
  return (
    <section className="admin-module" aria-labelledby="dashboard-title">
      <header><h2 id="dashboard-title">營運總覽</h2><p>{hkDate(data.today.date)} · 香港時間</p></header>
      <div className="admin-stats" aria-label="今日預約統計">
        <article><strong>{data.today.total}</strong><span>今日預約</span></article>
        <article><strong>{data.today.pending}</strong><span>待確認</span></article>
        <article><strong>{data.expiringPackages.length}</strong><span>30 日內到期套票</span></article>
        <article><strong>{data.failedNotifications.length}</strong><span>通知需跟進</span></article>
      </div>
      <div className="admin-dashboard-lists">
        <section><h3>即將到期套票</h3>{data.expiringPackages.length ? <ul>{data.expiringPackages.map(row => <li key={row.id}><strong>{row.customerName}</strong><span>{row.packageName} · 剩餘 {row.sessionsRemaining} 次</span><small>到期：{time(row.expiresAt)}</small></li>)}</ul> : <p className="admin-empty">暫無即將到期套票。</p>}</section>
        <section><h3>通知需跟進</h3>{data.failedNotifications.length ? <ul>{data.failedNotifications.map(row => <li key={row.id}><strong>{row.event}</strong><span>預約 #{row.bookingId || '—'}</span><small>{time(row.deliveredAt)}</small></li>)}</ul> : <p className="admin-empty">沒有需要跟進的通知。</p>}</section>
      </div>
    </section>
  )
}
