'use client'

import { useState } from 'react'

/**
 * Per-customer admin actions: GDPR export + hard delete.
 *
 * The endpoints already exist:
 *   GET  /api/admin/customers/[id]/export        -> attachment JSON
 *   POST /api/admin/customers/[id]/gdpr-delete    -> cascade + audit
 *
 * Both endpoints require an admin session; the browser cookie carries
 * the Supabase Auth session so a plain fetch is enough.
 */
export default function CustomerActions({ customerId, customerName }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const exportJson = async () => {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const r = await fetch(`/api/admin/customers/${customerId}/export`, { method: 'GET' })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || `Export failed (${r.status})`)
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cd = r.headers.get('Content-Disposition') || ''
      const match = /filename="([^"]+)"/.exec(cd)
      a.download = match?.[1] || `customer-${customerId}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setInfo('✓ 已下載。')
    } catch (e) {
      setError(e?.message || 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const gdprDelete = async () => {
    const phrase = `DELETE ${customerName || customerId}`
    const answer = prompt(
      `⚠️ 永久刪除客戶 #${customerId}？\n\n` +
      `呢個動作會連同以下一齊永久刪除：\n` +
      `  · 套票記錄\n  · 預約記錄\n  · 通知記錄\n\n` +
      `呢個動作 UNDO 唔到。\n\n` +
      `要確認，請輸入：${phrase}`,
    )
    if (!answer || answer.trim() !== phrase) {
      if (answer !== null) setError('確認文字唔啱，操作取消。')
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const r = await fetch(`/api/admin/customers/${customerId}/gdpr-delete`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `Delete failed (${r.status})`)
      setInfo(`✓ 已刪除。${d.deleted?.appointments ?? 0} 預約、${d.deleted?.customer_packages ?? 0} 套票。`)
      // Refresh the parent list after a moment
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      setError(e?.message || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed #ded5c8' }}>
      <h4 style={{ margin: '0 0 8px', color: '#c0392b' }}>資料管理（GDPR）</h4>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="admin-action"
          disabled={busy}
          onClick={exportJson}
        >
          📥 Export JSON
        </button>
        <button
          type="button"
          className="admin-action"
          disabled={busy}
          onClick={gdprDelete}
          style={{ color: '#c0392b', borderColor: '#c0392b' }}
        >
          🗑 GDPR 刪除
        </button>
      </div>
      {error && (
        <p role="alert" style={{ color: '#c0392b', fontSize: 12, marginTop: 8 }}>
          ⚠️ {error}
        </p>
      )}
      {info && (
        <p role="status" style={{ color: '#27ae60', fontSize: 12, marginTop: 8 }}>
          {info}
        </p>
      )}
    </div>
  )
}
