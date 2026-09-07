'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '../../lib/supabase/browser'

function balanceColor(remaining, total) {
  if (!total || remaining === 0) return '#c0392b'
  if (remaining <= Math.ceil(total * 0.25)) return '#e67e22'
  return '#27ae60'
}

// Strict numeric parse: returns null for NaN, 0, or empty
function safeNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export default function BookingForm({ services = [], packages = [] }) {
  const router = useRouter()
  const [form, setForm] = useState({
    serviceId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    startsAt: '',
    customerId: '',
    customerPackageId: '',
  })
  const [availablePackages, setAvailablePackages] = useState(packages || [])
  const [customerPackages, setCustomerPackages] = useState([])
  const [customerFound, setCustomerFound] = useState(null)
  const [lookupStatus, setLookupStatus] = useState('idle') // 'idle' | 'searching' | 'found' | 'not-found' | 'error'
  const [linkedServices, setLinkedServices] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [emptyMsg, setEmptyMsg] = useState('')

  // Load active packages on mount (props take precedence; otherwise fetch)
  useEffect(() => {
    if (packages && packages.length) {
      setAvailablePackages(packages)
      return
    }
    let cancelled = false
    fetch('/api/packages')
      .then((r) => {
        if (!r.ok) throw new Error('packages http ' + r.status)
        return r.json()
      })
      .then((d) => {
        if (!cancelled) setAvailablePackages(d.packages || [])
      })
      .catch(() => {
        if (!cancelled) setAvailablePackages([])
      })
    return () => { cancelled = true }
  }, [packages])

  // Load availability for the selected service + date
  const loadAvailability = useCallback(async () => {
    if (!form.serviceId || !date) return
    setLoadingSlots(true)
    setError('')
    setSlots([])
    setForm((f) => ({ ...f, startsAt: '' }))
    try {
      const r = await fetch(
        `/api/availability?date=${date}&serviceId=${form.serviceId}`,
      )
      const s = await r.json()
      if (!r.ok) {
        setEmptyMsg(s.error || '無法載入時段')
        return
      }
      setSlots(s.slots || [])
      if (s.slots?.length === 0) {
        setEmptyMsg('當日無可預約時段，請選擇其他日期')
      }
    } catch {
      setEmptyMsg('載入時段失敗，請稍後再試')
    } finally {
      setLoadingSlots(false)
    }
  }, [form.serviceId, date])

  useEffect(() => {
    loadAvailability()
  }, [loadAvailability])

  // Lookup customer by phone — debounced on blur, with explicit status state
  const lookupCustomer = useCallback(async (phone) => {
    if (!phone || phone.trim().length < 5) {
      setLookupStatus('idle')
      setCustomerFound(null)
      setCustomerPackages([])
      return
    }
    setLookupStatus('searching')
    try {
      const r = await fetch(`/api/customers?phone=${encodeURIComponent(phone.trim())}`)
      if (!r.ok) throw new Error('customers http ' + r.status)
      const d = await r.json()
      const found = d.customers?.[0]
      if (found) {
        setCustomerFound(found)
        setCustomerPackages(found.customer_packages || [])
        if (found.name) setForm((f) => ({ ...f, customerName: found.name }))
        if (found.email) setForm((f) => ({ ...f, customerEmail: found.email || '' }))
        setForm((f) => ({ ...f, customerId: found.id ? String(found.id) : '', customerPackageId: '' }))
        setLookupStatus('found')
      } else {
        setCustomerFound(null)
        setCustomerPackages([])
        setForm((f) => ({ ...f, customerId: '', customerPackageId: '' }))
        setLookupStatus('not-found')
      }
    } catch {
      setLookupStatus('error')
      setCustomerFound(null)
      setCustomerPackages([])
    }
  }, [])

  // Compute the selected package BEFORE any effect that references it
  const selectedPkg = customerPackages.find(
    (cp) => safeNumber(cp.id) === safeNumber(form.customerPackageId),
  )

  // When a package is selected, derive the list of services it covers
  useEffect(() => {
    if (selectedPkg?.packages?.package_services) {
      setLinkedServices(
        selectedPkg.packages.package_services
          .map((ps) => ps.service_id)
          .filter(Boolean),
      )
    } else {
      setLinkedServices([])
    }
  }, [selectedPkg])

  const handlePhoneBlur = () => lookupCustomer(form.customerPhone)

  const handlePackageChange = (pkgId) => {
    setForm((f) => ({ ...f, customerPackageId: pkgId ? String(pkgId) : '', serviceId: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    const cid = safeNumber(form.customerId)
    const cpkgid = safeNumber(form.customerPackageId)
    const svcId = safeNumber(form.serviceId)
    if (!svcId) { setError('請選擇服務'); return }
    if (!form.startsAt) { setError('請選擇日期及時段'); return }
    if (!form.customerName.trim()) { setError('請填寫姓名'); return }
    if (!form.customerPhone.trim()) { setError('請填寫電話'); return }

    setSubmitting(true)
    try {
      const body = {
        serviceId: svcId,
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim() || null,
        startsAt: form.startsAt,
        customerId: cid,
        customerPackageId: cpkgid,
      }
      const r = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || '預約失敗，請稍後再試。')
      const id = d.appointment?.id
      router.push(id ? `/booking/confirm?id=${id}` : '/booking/confirm')
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const visibleServices =
    form.customerPackageId && linkedServices.length > 0
      ? services.filter((s) => linkedServices.includes(s.id))
      : services

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form className="booking-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="form-error-box">
          <span>⚠️</span> {error}
        </div>
      )}
      {message && (
        <div className="form-success-box">✓ {message}</div>
      )}

      {/* Phone lookup */}
      <div className="form-section">
        <h3 className="form-section-title">📞 客戶資料</h3>
        <div className="form-group">
          <label htmlFor="customerPhone">電話號碼 *</label>
          <input
            id="customerPhone"
            type="tel"
            value={form.customerPhone}
            onChange={(e) =>
              setForm((f) => ({ ...f, customerPhone: e.target.value }))
            }
            onBlur={handlePhoneBlur}
            placeholder="例：91234567"
            required
            autoComplete="tel"
          />
          {lookupStatus === 'searching' && (
            <div className="customer-found-badge" style={{ color: '#706961' }}>
              查詢中…
            </div>
          )}
          {lookupStatus === 'found' && customerFound && (
            <div className="customer-found-badge">
              ✓ 找到客戶：{customerFound.name}（ID: {customerFound.id}）
              {customerPackages.length > 0 && ` · 可用套票 ${customerPackages.length} 張`}
            </div>
          )}
          {lookupStatus === 'not-found' && (
            <div className="customer-found-badge" style={{ color: '#706961' }}>
              這是新客戶，請填寫姓名繼續
            </div>
          )}
          {lookupStatus === 'error' && (
            <div className="customer-found-badge" style={{ color: '#c0392b' }}>
              客戶查詢失敗，請稍後再試
            </div>
          )}
        </div>
      </div>

      {/* Package selection */}
      {customerPackages.length > 0 && (
        <div className="form-section">
          <h3 className="form-section-title">🎫 使用套票</h3>
          <div className="package-grid">
            <label
              className={`package-card ${
                !form.customerPackageId ? 'selected' : ''
              }`}
              onClick={() => handlePackageChange('')}
            >
              <input
                type="radio"
                name="pkg"
                value=""
                checked={!form.customerPackageId}
                onChange={() => handlePackageChange('')}
              />
              <span className="pkg-name">不使用套票</span>
              <span className="pkg-sub">自費付款</span>
            </label>
            {customerPackages
              .filter(
                (cp) =>
                  cp.is_active &&
                  new Date(cp.expires_at) > new Date() &&
                  cp.sessions_remaining > 0,
              )
              .map((cp) => (
                <label
                  key={cp.id}
                  className={`package-card ${
                    Number(form.customerPackageId) === cp.id ? 'selected' : ''
                  }`}
                  style={{
                    borderLeftColor: cp.packages?.colour_hex || '#a98152',
                  }}
                  onClick={() => handlePackageChange(cp.id)}
                >
                  <input
                    type="radio"
                    name="pkg"
                    value={cp.id}
                    checked={Number(form.customerPackageId) === cp.id}
                    onChange={() => handlePackageChange(cp.id)}
                  />
                  <span className="pkg-name">{cp.packages?.name}</span>
                  <span
                    className="pkg-sessions"
                    style={{
                      color: balanceColor(
                        cp.sessions_remaining,
                        cp.total_sessions,
                      ),
                    }}
                  >
                    {cp.sessions_remaining}/{cp.total_sessions} 次
                  </span>
                  <span className="pkg-expire">
                    到期：
                    {new Date(cp.expires_at).toLocaleDateString('zh-HK')}
                  </span>
                </label>
              ))}
          </div>
        </div>
      )}

      {/* Service */}
      <div className="form-section">
        <h3 className="form-section-title">✂️ 選擇服務</h3>
        <div className="service-grid">
          {visibleServices.map((s) => (
            <label
              key={s.id}
              className={`service-card ${
                Number(form.serviceId) === s.id ? 'selected' : ''
              }`}
              onClick={() =>
                setForm((f) => ({ ...f, serviceId: String(s.id) }))
              }
            >
              <input
                type="radio"
                name="service"
                value={s.id}
                checked={Number(form.serviceId) === s.id}
                onChange={() =>
                  setForm((f) => ({ ...f, serviceId: String(s.id) }))
                }
              />
              <span className="svc-name">{s.name}</span>
              <span className="svc-meta">{s.duration_minutes}分鐘</span>
              <span className="svc-price">HK${(s.price / 100).toFixed(0)}</span>
            </label>
          ))}
        </div>
        {form.customerPackageId &&
          services.filter((s) => !linkedServices.includes(s.id)).length > 0 && (
            <>
              <div className="service-divider">其他服務（自費）</div>
              <div className="service-grid">
                {services
                  .filter((s) => !linkedServices.includes(s.id))
                  .map((s) => (
                    <label
                      key={s.id}
                      className={`service-card ${
                        Number(form.serviceId) === s.id ? 'selected' : ''
                      }`}
                      onClick={() =>
                        setForm((f) => ({ ...f, serviceId: String(s.id) }))
                      }
                    >
                      <input
                        type="radio"
                        name="service"
                        value={s.id}
                        checked={Number(form.serviceId) === s.id}
                        onChange={() =>
                          setForm((f) => ({ ...f, serviceId: String(s.id) }))
                        }
                      />
                      <span className="svc-name">{s.name}</span>
                      <span className="svc-meta">{s.duration_minutes}分鐘</span>
                      <span className="svc-price">
                        HK${(s.price / 100).toFixed(0)}
                      </span>
                    </label>
                  ))}
              </div>
            </>
          )}
      </div>

      {/* Date / Time */}
      <div className="form-section">
        <h3 className="form-section-title">📅 選擇日期及時間</h3>
        <div className="form-group">
          <label htmlFor="datePicker">日期</label>
          <input
            id="datePicker"
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {form.serviceId && (
          <div className="time-slots-container">
            {loadingSlots && (
              <div className="slots-loading">載入時段中…</div>
            )}
            {emptyMsg && <div className="slots-empty">{emptyMsg}</div>}
            {!loadingSlots && !emptyMsg && slots.length > 0 && (
              <>
                <p className="slots-hint">
                  可選時段（已屏蔽已被預約的時間）：
                </p>
                <div className="time-slots-grid">
                  {slots.map((s) => {
                    // API now returns { label, iso } so we can store an
                    // unambiguous +08:00 offset instead of guessing.
                    const slotLabel = typeof s === 'string' ? s : s.label
                    const slotIso = typeof s === 'string' ? `${date}T${s}:00+08:00` : s.iso
                    return (
                      <label
                        key={slotIso}
                        className={`time-slot ${
                          form.startsAt === slotIso ? 'selected' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="timeslot"
                          value={slotIso}
                          checked={form.startsAt === slotIso}
                          onChange={() =>
                            setForm((f) => ({ ...f, startsAt: slotIso }))
                          }
                        />
                        {slotLabel}
                      </label>
                    )
                  })}
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
            <input
              id="customerName"
              type="text"
              value={form.customerName}
              onChange={(e) =>
                setForm((f) => ({ ...f, customerName: e.target.value }))
              }
              placeholder="你的姓名"
              required
              autoComplete="name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="customerEmail">電郵（選填）</label>
            <input
              id="customerEmail"
              type="email"
              value={form.customerEmail}
              onChange={(e) =>
                setForm((f) => ({ ...f, customerEmail: e.target.value }))
              }
              placeholder="example@email.com"
              autoComplete="email"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="booking-submit-btn"
        disabled={submitting || !form.startsAt || !form.serviceId}
      >
        {submitting ? '提交中…' : '✓ 確認預約'}
      </button>
    </form>
  )
}
