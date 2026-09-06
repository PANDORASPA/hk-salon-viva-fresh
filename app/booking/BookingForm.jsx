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
    serviceId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    startsAt: '',
    customerId: '',
    customerPackageId: '',
  })
  const [packages, setPackages] = useState([])
  const [customerPackages, setCustomerPackages] = useState([])
  const [customerFound, setCustomerFound] = useState(null)
  const [linkedServices, setLinkedServices] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Time slot picker state
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState('')

  // Load active packages on mount
  useEffect(() => {
    fetch('/api/packages').then(r => r.json()).then(d => setPackages(d.packages || []))
  }, [])

  // Load time slots when service + date change
  const loadSlots = useCallback(async () => {
    if (!form.serviceId || !selectedDate) return
    setLoadingSlots(true)
    setSlotsError('')
    setSlots([])
    setForm(f => ({ ...f, startsAt: '' }))
    try {
      const r = await fetch(`/api/availability?date=${selectedDate}&serviceId=${form.serviceId}`)
      const d = await r.json()
      if (!r.ok) { setSlotsError(d.error || '無法載入時段'); return }
      setSlots(d.slots || [])
      if (d.slots?.length === 0) setSlotsError('当日无可预约时段，请选择其他日期')
    } catch {
      setSlotsError('載入時段失敗')
    } finally {
      setLoadingSlots(false)
    }
  }, [form.serviceId, selectedDate])

  useEffect(() => { loadSlots() }, [loadSlots])

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

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form className="booking-form" onSubmit={handleSubmit} noValidate>
      {error && <div className="form-error-box"><span>⚠️</span> {error}</div>}
      {message && <div className="form-success-box">✓ {message}</div>}

      {/* Phone lookup */}
      <div className="form-section">
        <h3 className="form-section-title">📞 客戶資料</h3>
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
            <div className="customer-found-badge">
              ✓ 找到客戶：{customerFound.name}
            </div>
          )}
        </div>
      </div>

      {/* Package selection */}
      {customerPackages.length > 0 && (
        <div className="form-section">
          <h3 className="form-section-title">🎫 使用套票</h3>
          <div className="package-grid">
            <label className={`package-card ${!form.customerPackageId ? 'selected' : ''}`}
              onClick={() => handlePackageChange('')}>
              <input type="radio" name="pkg" value="" checked={!form.customerPackageId} onChange={() => handlePackageChange('')} />
              <span className="pkg-name">不使用套票</span>
              <span className="pkg-sub">自費付款</span>
            </label>
            {customerPackages.filter(cp => cp.is_active && new Date(cp.expires_at) > new Date() && cp.sessions_remaining > 0).map(cp => (
              <label key={cp.id}
                className={`package-card ${Number(form.customerPackageId) === cp.id ? 'selected' : ''}`}
                style={{ borderLeftColor: cp.packages?.colour_hex || '#a98152' }}
                onClick={() => handlePackageChange(cp.id)}>
                <input type="radio" name="pkg" value={cp.id} checked={Number(form.customerPackageId) === cp.id} onChange={() => handlePackageChange(cp.id)} />
                <span className="pkg-name">{cp.packages?.name}</span>
                <span className="pkg-sessions" style={{ color: balanceColor(cp.sessions_remaining, cp.total_sessions) }}>
                  {cp.sessions_remaining}/{cp.total_sessions} 次
                </span>
                <span className="pkg-expire">到期：{new Date(cp.expires_at).toLocaleDateString('zh-HK')}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Service */}
      <div className="form-section">
        <h3 className="form-section-title">✂️ 選擇服務</h3>
        <div className="service-grid">
          {visibleServices.map(s => (
            <label key={s.id} className={`service-card ${Number(form.serviceId) === s.id ? 'selected' : ''}`}
              onClick={() => setForm(f => ({ ...f, serviceId: String(s.id) }))}>
              <input type="radio" name="service" value={s.id} checked={Number(form.serviceId) === s.id}
                onChange={() => setForm(f => ({ ...f, serviceId: String(s.id) }))} />
              <span className="svc-name">{s.name}</span>
              <span className="svc-meta">{s.duration_minutes}分鐘</span>
              <span className="svc-price">HK${(s.price / 100).toFixed(0)}</span>
            </label>
          ))}
        </div>
        {form.customerPackageId && services.filter(s => !linkedServices.includes(s.id)).length > 0 && (
          <div className="service-divider">其他服務（自費）</div>
        )}
        {form.customerPackageId && (
          <div className="service-grid">
            {services.filter(s => !linkedServices.includes(s.id)).map(s => (
              <label key={s.id} className={`service-card ${Number(form.serviceId) === s.id ? 'selected' : ''}`}
                onClick={() => setForm(f => ({ ...f, serviceId: String(s.id) }))}>
                <input type="radio" name="service" value={s.id} checked={Number(form.serviceId) === s.id}
                  onChange={() => setForm(f => ({ ...f, serviceId: String(s.id) }))} />
                <span className="svc-name">{s.name}</span>
                <span className="svc-meta">{s.duration_minutes}分鐘</span>
                <span className="svc-price">HK${(s.price / 100).toFixed(0)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Date + Time slot picker */}
      <div className="form-section">
        <h3 className="form-section-title">📅 選擇日期及時間</h3>
        <div className="form-group">
          <label htmlFor="datePicker">日期</label>
          <input
            id="datePicker"
            type="date"
            value={selectedDate}
            min={today}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </div>

        {form.serviceId && (
          <div className="time-slots-container">
            {loadingSlots && <div className="slots-loading">載入時段中…</div>}
            {slotsError && <div className="slots-empty">{slotsError}</div>}
            {!loadingSlots && !slotsError && slots.length > 0 && (
              <>
                <p className="slots-hint">可選時段（已屏蔽已被預約的時間）：</p>
                <div className="time-slots-grid">
                  {slots.map(slot => (
                    <label key={slot} className={`time-slot ${form.startsAt === `${selectedDate}T${slot}` ? 'selected' : ''}`}>
                      <input type="radio" name="timeslot" value={slot}
                        checked={form.startsAt === `${selectedDate}T${slot}`}
                        onChange={() => setForm(f => ({ ...f, startsAt: `${selectedDate}T${slot}` }))} />
                      {slot}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Name + Email */}
      <div className="form-section">
        <h3 className="form-section-title">👤 聯絡方式</h3>
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
      </div>

      <button type="submit" className="booking-submit-btn" disabled={submitting || !form.startsAt || !form.serviceId}>
        {submitting ? '提交中…' : '✓ 確認預約'}
      </button>
    </form>
  )
}
