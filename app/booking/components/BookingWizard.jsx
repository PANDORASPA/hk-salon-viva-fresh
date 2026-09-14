'use client'

import { useEffect, useMemo, useReducer, useState } from 'react'
import { useRouter } from 'next/navigation'
import { bookingReducer, initialBookingState } from './booking-reducer'
import ServiceStep from './ServiceStep'
import StaffStep from './StaffStep'
import TimeStep from './TimeStep'
import ContactStep from './ContactStep'
import ReviewStep from './ReviewStep'

const stepLabels = ['服務', '員工', '時間', '聯絡方式', '確認']

function tomorrow() {
  const day = new Date()
  day.setDate(day.getDate() + 1)
  return day.toISOString().slice(0, 10)
}

function apiError(body, fallback) {
  return body?.error || fallback
}

export default function BookingWizard({ services = [], authenticated = false }) {
  const router = useRouter()
  const [state, dispatch] = useReducer(bookingReducer, { ...initialBookingState, date: tomorrow() })
  const [serviceOptions, setServiceOptions] = useState(services)
  const [staff, setStaff] = useState([])
  const [slots, setSlots] = useState([])
  const [packages, setPackages] = useState([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [staffError, setStaffError] = useState('')
  const [availabilityMessage, setAvailabilityMessage] = useState('請選擇日期以查看時段。')

  const selectedService = useMemo(() => serviceOptions.find((service) => String(service.id) === String(state.serviceId)), [serviceOptions, state.serviceId])
  const selectedStaff = useMemo(() => staff.find((person) => String(person.id) === String(state.staffPreference)), [staff, state.staffPreference])

  useEffect(() => {
    let active = true
    fetch('/api/services').then(async (response) => {
      const body = await response.json()
      if (!response.ok) throw new Error(apiError(body, '無法載入服務'))
      if (active) setServiceOptions(body.services || [])
    }).catch(() => { /* Server-rendered services remain available as a fallback. */ })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!authenticated) return undefined
    let active = true
    fetch('/api/customers/me').then(async (response) => {
      if (response.status === 401) return null
      const body = await response.json()
      if (!response.ok) throw new Error(apiError(body, '無法載入套票'))
      return body.customer?.customer_packages || []
    }).then((items) => { if (active && items) setPackages(items) }).catch(() => { if (active) setPackages([]) })
    return () => { active = false }
  }, [authenticated])

  useEffect(() => {
    if (!state.serviceId) return undefined
    const controller = new AbortController()
    setStaffLoading(true)
    setStaffError('')
    fetch(`/api/staff?serviceId=${encodeURIComponent(state.serviceId)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(apiError(body, '無法載入服務員工'))
        setStaff(body.staff || [])
      })
      .catch((error) => { if (error.name !== 'AbortError') setStaffError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setStaffLoading(false) })
    return () => controller.abort()
  }, [state.serviceId])

  useEffect(() => {
    if (!state.serviceId || !state.date) return undefined
    const controller = new AbortController()
    setAvailabilityLoading(true)
    setAvailabilityMessage('')
    const params = new URLSearchParams({ date: state.date, serviceId: String(state.serviceId), staffId: String(state.staffPreference) })
    fetch(`/api/availability?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(apiError(body, '無法載入時段'))
        setSlots(body.slots || [])
        setAvailabilityMessage(body.slots?.length ? '請選擇可預約時段。' : '當日無可預約時段，請選擇其他日期。')
      })
      .catch((error) => { if (error.name !== 'AbortError') { setSlots([]); setAvailabilityMessage(error.message) } })
      .finally(() => { if (!controller.signal.aborted) setAvailabilityLoading(false) })
    return () => controller.abort()
  }, [state.serviceId, state.date, state.staffPreference])

  const canAdvance = state.step === 1 ? Boolean(state.serviceId)
    : state.step === 2 ? Boolean(state.staffPreference)
      : state.step === 3 ? Boolean(state.startsAt)
        : state.step === 4 ? Boolean(state.contact.name.trim() && state.contact.phone.trim()) : false

  async function submit() {
    dispatch({ type: 'SUBMIT_START' })
    try {
      const response = await fetch('/api/appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: Number(state.serviceId), staffPreference: state.staffPreference,
          startsAt: state.startsAt, customerName: state.contact.name.trim(),
          customerPhone: state.contact.phone.trim(), customerEmail: state.contact.email.trim() || null,
          customerPackageId: state.customerPackageId ? Number(state.customerPackageId) : null,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        dispatch({ type: 'SUBMIT_ERROR', error: apiError(body, '預約失敗，請稍後再試。'), status: response.status })
        return
      }
      const id = body.appointment?.id
      router.push(id ? `/booking/confirm?id=${id}` : '/booking/confirm')
    } catch {
      dispatch({ type: 'SUBMIT_ERROR', error: '網絡連線出現問題，請稍後再試。' })
    }
  }

  const stepComponent = state.step === 1 ? <ServiceStep services={serviceOptions} selectedServiceId={state.serviceId} onSelect={(serviceId) => dispatch({ type: 'SELECT_SERVICE', serviceId })} />
    : state.step === 2 ? <StaffStep staff={staff} staffPreference={state.staffPreference} loading={staffLoading} error={staffError} onSelect={(staffPreference) => dispatch({ type: 'SELECT_STAFF', staffPreference })} />
      : state.step === 3 ? <TimeStep date={state.date} minDate={tomorrow()} slots={slots} selectedSlot={state.startsAt} loading={availabilityLoading} message={availabilityMessage} onDateChange={(date) => dispatch({ type: 'SELECT_SLOT', date, startsAt: '' })} onSelect={(startsAt) => dispatch({ type: 'SELECT_SLOT', date: state.date, startsAt })} />
        : state.step === 4 ? <ContactStep contact={state.contact} authenticated={authenticated} onChange={(contact) => dispatch({ type: 'SET_CONTACT', contact })} />
          : <ReviewStep state={state} service={selectedService} staff={selectedStaff} packages={packages} authenticated={authenticated} onPackageChange={(customerPackageId) => dispatch({ type: 'SELECT_PACKAGE', customerPackageId })} onTermsChange={(acceptedTerms) => dispatch({ type: 'SET_CONTACT', acceptedTerms })} onSubmit={submit} />

  return (
    <div className="booking-wizard">
      <ol className="booking-progress" aria-label="預約步驟">
        {stepLabels.map((label, index) => <li key={label} aria-current={state.step === index + 1 ? 'step' : undefined}>{index + 1}. {label}</li>)}
      </ol>
      {state.error && <p className="booking-error" role="alert">{state.error}{state.conflict && ' 已保留你的選擇，請返回時間步驟選擇另一個時段。'}</p>}
      {stepComponent}
      {state.step < 5 && (
        <div className="booking-actions">
          {state.step > 1 && <button type="button" className="booking-secondary" onClick={() => dispatch({ type: 'BACK' })}>上一步</button>}
          <button type="button" className="booking-primary" disabled={!canAdvance} onClick={() => dispatch({ type: 'NEXT' })}>下一步</button>
        </div>
      )}
      {state.step === 5 && <div className="booking-actions"><button type="button" className="booking-secondary" onClick={() => dispatch({ type: 'BACK' })}>返回修改</button></div>}
    </div>
  )
}
