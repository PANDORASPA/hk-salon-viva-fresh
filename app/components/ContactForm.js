'use client'
import { useState } from 'react'

export default function ContactForm({ whatsapp }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' })
  const [status, setStatus] = useState('idle') // idle | submitting | success | error

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.message.trim()) return
    setStatus('submitting')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setStatus('success')
        setForm({ name: '', phone: '', email: '', message: '' })
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div style={{ padding: '24px 28px', background: '#f0ede6', borderRadius: 8, border: '1.5px solid #c9a96e', textAlign: 'center' }}>
        <p style={{ fontSize: 28, margin: '0 0 8px' }}>✓</p>
        <h3 style={{ margin: '0 0 8px', fontFamily: 'Georgia,serif' }}>訊息已發送！</h3>
        <p style={{ color: '#706961', margin: '0 0 16px' }}>感謝你的查詢，我們會盡快回覆你。</p>
        {whatsapp && (
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener" className="salon-button">
            或即時 WhatsApp 查詢
          </a>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 560 }}>
      {status === 'error' && (
        <div role="alert" style={{ padding: '10px 16px', background: '#fde8e8', border: '1px solid #e53e3e', borderRadius: 6, color: '#c53030', marginBottom: 16, fontSize: 14 }}>
          發送失敗，請稍後再試或使用 WhatsApp 聯絡我們。
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#706961', marginBottom: 4 }}>
            姓名 <span style={{ color: '#c53030' }}>*</span>
          </label>
          <input
            type="text" value={form.name} onChange={set('name')} required
            placeholder="你的姓名"
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d4c9b8', borderRadius: 6, fontSize: 14, background: '#faf8f4', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#706961', marginBottom: 4 }}>電話</label>
          <input
            type="tel" value={form.phone} onChange={set('phone')}
            placeholder="香港電話（可選）"
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d4c9b8', borderRadius: 6, fontSize: 14, background: '#faf8f4', boxSizing: 'border-box' }}
          />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#706961', marginBottom: 4 }}>電郵</label>
        <input
          type="email" value={form.email} onChange={set('email')}
          placeholder="你的電郵（可選）"
          style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d4c9b8', borderRadius: 6, fontSize: 14, background: '#faf8f4', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#706961', marginBottom: 4 }}>
          訊息 <span style={{ color: '#c53030' }}>*</span>
        </label>
        <textarea
          value={form.message} onChange={set('message')} required rows={4}
          placeholder="請描述你的查詢..."
          style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d4c9b8', borderRadius: 6, fontSize: 14, background: '#faf8f4', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>
      <button
        type="submit" disabled={status === 'submitting'}
        className="salon-button"
        style={{ opacity: status === 'submitting' ? 0.7 : 1, cursor: status === 'submitting' ? 'not-allowed' : 'pointer' }}
      >
        {status === 'submitting' ? '發送中…' : '發送訊息'}
      </button>
    </form>
  )
}
