'use client'
import { useState } from 'react'

export default function PackagePurchaseForm({ package: pkg }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/packages/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          customerName: form.name.trim(),
          customerPhone: form.phone.trim(),
          customerEmail: form.email.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || '提交失敗')

      setMessage(`✅ 已收到你的查詢！我們會盡快透過 WhatsApp 聯繫你確認套票購買細節。`)
      setForm({ name: '', phone: '', email: '', notes: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="purchase-form" onSubmit={handleSubmit}>
      {error && (
        <div className="form-error-box">
          <span>⚠️</span> {error}
        </div>
      )}
      {message && (
        <div className="form-success-box">
          <span>✓</span> {message}
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor={`name-${pkg.id}`}>姓名 *</label>
          <input
            id={`name-${pkg.id}`}
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="你的姓名"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor={`phone-${pkg.id}`}>WhatsApp 電話 *</label>
          <input
            id={`phone-${pkg.id}`}
            type="tel"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="例：91234567"
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor={`email-${pkg.id}`}>電郵（選填）</label>
        <input
          id={`email-${pkg.id}`}
          type="email"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="example@email.com"
        />
      </div>

      <div className="form-group">
        <label htmlFor={`notes-${pkg.id}`}>備註（選填）</label>
        <textarea
          id={`notes-${pkg.id}`}
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="例如：想了解分期付款、或其他問題…"
          rows={3}
        />
      </div>

      <button type="submit" className="purchase-submit-btn" disabled={submitting}>
        {submitting ? '提交中…' : '📩 提交查詢'}
      </button>

      <p className="purchase-note">
        💬 提交後我們會透過 WhatsApp 聯繫你，確認套票詳情及付款方式
      </p>
    </form>
  )
}
