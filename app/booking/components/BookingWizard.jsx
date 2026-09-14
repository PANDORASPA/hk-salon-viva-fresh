'use client'

import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { bookingReducer, initialBookingState } from './booking-reducer'
import ServiceStep from './ServiceStep'
import StaffStep from './StaffStep'
import TimeStep from './TimeStep'
import ContactStep from './ContactStep'
import ReviewStep from './ReviewStep'
import { hongKongDate } from './booking-time'
import { loadAvailability, loadCustomerPackages, filterCustomerPackages, packageResult } from './booking-data'
import { confirmationUrl } from './booking-confirmation'

const stepLabels = ['服務', '員工', '時間', '聯絡方式', '確認']

function apiError(body, fallback) {
  return body?.error || fallback
}

export default function BookingWizard({ services = [], authenticated = false }) {
  const router = useRouter()
  const [state, dispatch] = useReducer(bookingReducer, { ...initialBookingState, date: hongKongDate() })
  const [serviceOptions, setServiceOptions] = useState(services)
  const [staff, setStaff] = useState([])
  const [slots, setSlots] = useState([])
  const [packageState, setPackageState] = useState({ status: authenticated ? 'loading' : 'guest', packages: [] })
  const [staffLoading, setStaffLoading] = useState(false)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [staffError, setStaffError] = useState('')
  const [availabilityMessage, setAvailabilityMessage] = useState('請選擇日期以查看時段。')
  const [staffRefresh, setStaffRefresh] = useState(0)
  const [packageRefresh, setPackageRefresh] = useState(0)
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0)
  const headingRef = useRef(null)
  const submitLock = useRef(false)
  const eligiblePackages = filterCustomerPackages(packageState.packages, state.serviceId, state.startsAt)
  const reviewPackages = ['ready','empty'].includes(packageState.status) ? packageResult(eligiblePackages) : packageState

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
    setPackageState({ status: 'loading', packages: [] })
    loadCustomerPackages(fetch).then((result) => { if (active) { setPackageState(result); dispatch({ type: 'PREFILL_CONTACT', contact: result.contact }) } })
      .catch((error) => { if (active) setPackageState({ status: 'error', packages: [], error: error.message }) })
    return () => { active = false }
  }, [authenticated, packageRefresh])

  useEffect(() => {
    if (!state.serviceId) return undefined
    const controller = new AbortController()
    setStaffLoading(true)
    setStaffError('')
    setStaff([])
    fetch(`/api/staff?serviceId=${encodeURIComponent(state.serviceId)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(apiError(body, '無法載入服務員工'))
        setStaff(body.staff || [])
      })
      .catch((error) => { if (error.name !== 'AbortError') setStaffError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setStaffLoading(false) })
    return () => controller.abort()
  }, [state.serviceId, staffRefresh])

  useEffect(() => {
    if (!state.serviceId || !state.date) return undefined
    const controller = new AbortController()
    setAvailabilityLoading(true)
    setAvailabilityMessage('')
    setSlots([])
    loadAvailability(fetch, { date: state.date, serviceId: state.serviceId, staffPreference: state.staffPreference }, controller.signal)
      .then(({ slots: nextSlots, message }) => { setSlots(nextSlots); setAvailabilityMessage(message) })
      .catch((error) => { if (error.name !== 'AbortError') { setSlots([]); setAvailabilityMessage(error.message) } })
      .finally(() => { if (!controller.signal.aborted) setAvailabilityLoading(false) })
    return () => controller.abort()
  }, [state.serviceId, state.date, state.staffPreference, availabilityRefresh])

  useEffect(() => {
    headingRef.current?.focus()
  }, [state.step])

  const canAdvance = state.step === 1 ? Boolean(state.serviceId)
    : state.step === 2 ? Boolean(state.staffPreference)
      : state.step === 3 ? Boolean(state.startsAt)
        : state.step === 4 ? Boolean(state.contact.name.trim() && state.contact.phone.trim()) : false

  async function submit() {
    if (submitLock.current) return
    if (state.customerPackageId && !eligiblePackages.some(row => String(row.id) === String(state.customerPackageId))) { dispatch({ type: 'SELECT_PACKAGE', customerPackageId: '' }); dispatch({ type: 'SUBMIT_ERROR', error: '所選套票不適用於此服務或日期，請重新選擇。' }); return }
    submitLock.current = true
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
        const error = apiError(body, '預約失敗，請稍後再試。')
        if (response.status === 409) {
          dispatch({ type: 'SLOT_CONFLICT', error })
          setAvailabilityRefresh((value) => value + 1)
        } else dispatch({ type: 'SUBMIT_ERROR', error, status: response.status })
        return
      }
      router.push(confirmationUrl(body))
    } catch {
      dispatch({ type: 'SUBMIT_ERROR', error: '網絡連線出現問題，請稍後再試。' })
    } finally { submitLock.current = false }
  }

  const stepComponent = state.step === 1 ? <ServiceStep headingRef={headingRef} services={serviceOptions} selectedServiceId={state.serviceId} onSelect={(serviceId) => dispatch({ type: 'SELECT_SERVICE', serviceId })} />
    : state.step === 2 ? <StaffStep headingRef={headingRef} staff={staff} staffPreference={state.staffPreference} loading={staffLoading} error={staffError} onSelect={(staffPreference) => dispatch({ type: 'SELECT_STAFF', staffPreference })} onRetry={() => setStaffRefresh((value) => value + 1)} />
      : state.step === 3 ? <TimeStep headingRef={headingRef} date={state.date} minDate={hongKongDate()} slots={slots} selectedSlot={state.startsAt} loading={availabilityLoading} message={availabilityMessage} onDateChange={(date) => dispatch({ type: 'SELECT_SLOT', date, startsAt: '' })} onSelect={(startsAt) => dispatch({ type: 'SELECT_SLOT', date: state.date, startsAt })} />
        : state.step === 4 ? <ContactStep headingRef={headingRef} contact={state.contact} authenticated={authenticated} onChange={(contact) => dispatch({ type: 'SET_CONTACT', contact })} />
          : <ReviewStep headingRef={headingRef} state={state} service={selectedService} staff={selectedStaff} packageState={reviewPackages} authenticated={authenticated} onPackageChange={(customerPackageId) => dispatch({ type: 'SELECT_PACKAGE', customerPackageId })} onTermsChange={(acceptedTerms) => dispatch({ type: 'SET_CONTACT', acceptedTerms })} onSubmit={submit} onRetryPackages={() => setPackageRefresh((value) => value + 1)} />

  return (
    <div className="booking-wizard">
      <ol className="booking-progress" aria-label="預約步驟">
        {stepLabels.map((label, index) => <li key={label} aria-current={state.step === index + 1 ? 'step' : undefined}>{index + 1}. {label}</li>)}
      </ol>
      <p className="booking-sr-only" aria-live="polite" aria-atomic="true">第 {state.step} 步，共 5 步：{stepLabels[state.step - 1]}</p>
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
