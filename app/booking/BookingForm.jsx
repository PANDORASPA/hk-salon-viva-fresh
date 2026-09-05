'use client'
import { useState, useEffect, useCallback } from 'react'
import { getBrowserClient } from '../../lib/supabase/browser'

function balanceColor(remaining, total) {
  if (!total || remaining === 0) return '#c0392b'
  if (remaining <= Math.ceil(total * 0.25)) return '#e67e22'
  return '#27ae60'
}

export default function BookingForm({ services = [] }) {
  const [form, setForm] = useState({
    serviceId: '', customerName: '', customerPhone: '', customerEmail: '',
    startsAt: '', customerId: '', customerPackageId: '',
  })
  const [packages, setPackages] = useState([])
  const [customerPackages, setCustomerPackages] = useState([])
  const [customerFound, setCustomerFound] = useState(null)
  const [linkedServices, setLinkedServices] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Load active packages on mount
  useEffect(() => {
    fetch('/api/packages').then(r => r.json()).then(d => setPackages(d.packages || []))
  }, [])

  // Lookup customer by phone
  const lookupCustomer = useCallback(async (phone) => {
    if (!phone || phone.trim().length < 5) return
    try {
      const r = await fetch(`/api/customers?phone=${encodeURIComponent(phone.trim())}`)
      const d = await r.json()
      const found = d.customers?.[0]
      if (found) {
        setCustomerFound(found)
        setCustomerPackages(found.customer_packages || [])
        if (found.name) setForm(f => ({ ...f, customerName: found.name }))
        if (found.email) setForm(f => ({ ...f, customerEmail: found.email || '' }))
        setForm(f => ({ ...f, customerId: found.id, customerPackageId: '' }))
      } else {
        setCustomerFound(null)
        setCustomerPackages([])
        setForm(f => ({ ...f, customerId: '', customerPackageId: '' }))
      }
    } catch (_) {}
  }, [])

  // When package selected, filter linked services
  useEffect(() => {
    if (!form.customerPackageId) { setLinkedServices([]); return }
    const pkg = customerPackages.find(cp => cp.id === Number(form.customerPackageId))
    if (pkg?.packages?.package_services) {
      setLinkedServices(pkg.packages.package_services.map(ps => ps.service_id))
    }
  }, [form.customerPackageId, customerPackages])

  const handlePhoneBlur = () => lookupCustomer(form.customerPhone)

  const handlePackageChange = (pkgId) => {
    setForm(f => ({ ...f, customerPackageId: pkgId, serviceId: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      const body = {
        serviceId: Number(form.serviceId),
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim() || null,
        startsAt: form.startsAt,
        customerId: form.customerId ? Number(form.customerId) : null,
        customerPackageId: form.customerPackageId ? Number(form.customerPackageId) : null,
      }
      const r = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || '預約失敗，請稍後再試。')
      setMessage('✅ 預約成功！我們會盡快確認。')
      setForm({ serviceId: '', customerName: '', customerPhone: '', customerEmail: '', startsAt: '', customerId: '', customerPackageId: '' })
      setCustomerFound(null)
      setCustomerPackages([])
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedPkg = customerPackages.find(cp => cp.id === Number(form.customerPackageId))
  const visibleServices = form.customerPackageId && linkedServices.length > 0
    ? services.filter(s => linkedServices.includes(s.id))
    : services

  return (
    <form className="booking-form" onSubmit={handleSubmit} noValidate>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}

      {/* Phone lookup */}
      <div className="form-group">
        <label htmlFor="customerPhone">電話號碼 *</label>
        <input
          id="customerPhone"
          type="tel"
          value={form.customerPhone}
          onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
          onBlur={handlePhoneBlur}
          placeholder="例：91234567"
          required
        />
        {customerFound && (
          <p className="customer-found">
            ✓ 找到客戶：{customerFound.name}
          </p>
        )}
      </div>

      {/* Package selection */}
      {customerPackages.length > 0 && (
        <div className="form-group">
          <label>使用套票（可選）</label>
          <div className="package-options">
            <label className="package-option">
              <input type="radio" name="pkg" value="" checked={!form.customerPackageId} onChange={() => handlePackageChange('')} />
              <span>不使用套票（自費）</span>
            </label>
            {customerPackages.map(cp => (
              cp.is_active && new Date(cp.expires_at) > new Date() && cp.sessions_remaining > 0 && (
                <label key={cp.id} className="package-option" style={{ borderLeftColor: cp.packages?.colour_hex || '#a98152' }}>
                  <input type="radio" name="pkg" value={cp.id} checked={Number(form.customerPackageId) === cp.id} onChange={() => handlePackageChange(cp.id)} />
                  <span>
                    <strong>{cp.packages?.name}</strong>
                    <span style={{ color: balanceColor(cp.sessions_remaining, cp.total_sessions), marginLeft: 8, fontWeight: 600 }}>
                      {cp.sessions_remaining}/{cp.total_sessions} 次
                    </span>
                  </span>
                </label>
              )
            ))}
          </div>
        </div>
      )}

      {/* Service */}
      <div className="form-group">
        <label htmlFor="serviceId">服務項目 *</label>
        <select
          id="serviceId"
          value={form.serviceId}
          onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}
          required
        >
          <option value="">請選擇服務…</option>
          {visibleServices && <optgroup label="套票包含服務">{visibleServices.map(s => <option key={s.id} value={s.id}>{s.name}（{s.duration_minutes}分鐘）</option>)}</optgroup>}
          {!visibleServices && services.map(s => <option key={s.id} value={s.id}>{s.name} — HK${(s.price / 100).toFixed(0)}（{s.duration_minutes}分鐘）</option>)}
          {visibleServices && services.filter(s => !linkedServices.includes(s.id)).length > 0 && (
            <optgroup label="其他服務（自費）">
              {services.filter(s => !linkedServices.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name} — HK${(s.price / 100).toFixed(0)}（{s.duration_minutes}分鐘）</option>)}
            </optgroup>
          )}
        </select>
      </div>

      {/* Name + Email */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="customerName">姓名 *</label>
          <input id="customerName" type="text" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="你的姓名" required />
        </div>
        <div className="form-group">
          <label htmlFor="customerEmail">電郵（選填）</label>
          <input id="customerEmail" type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} placeholder="example@email.com" />
        </div>
      </div>

      {/* Date/Time */}
      <div className="form-group">
        <label htmlFor="startsAt">希望時間 *</label>
        <input id="startsAt" type="datetime-local" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} required />
      </div>

      <button type="submit" className="salon-button" disabled={submitting}>
        {submitting ? '提交中…' : '確認預約'}
      </button>
    </form>
  )
}
