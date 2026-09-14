import React from 'react'
import { formatHongKongDateTime } from './booking-time.js'

const h = React.createElement

function usablePackages(packages) {
  const now = Date.now()
  return packages.filter((item) => item.is_active && item.sessions_remaining > 0 && new Date(item.expires_at).getTime() > now)
}

export default function ReviewStep({ state, service, staff, packages, packageState, authenticated, onPackageChange, onTermsChange, onSubmit, onRetryPackages, headingRef }) {
  const currentPackageState = packageState || { status: authenticated ? 'empty' : 'guest', packages }
  const packageOptions = currentPackageState.status === 'ready' ? usablePackages(currentPackageState.packages) : []
  const selectedPackage = packageOptions.find((item) => String(item.id) === String(state.customerPackageId))
  const payment = currentPackageState.status === 'loading'
    ? h('p', { className: 'booking-status', 'aria-live': 'polite' }, '正在載入套票…')
    : currentPackageState.status === 'error'
      ? h('div', { className: 'booking-error', role: 'alert' }, currentPackageState.error, h('button', { type: 'button', className: 'booking-secondary', onClick: onRetryPackages }, '重新載入套票'))
      : h('fieldset', { className: 'booking-payment' },
        h('legend', null, '付款方式'),
        h('label', { className: 'booking-payment-option' }, h('input', { type: 'radio', name: 'package', checked: !state.customerPackageId, onChange: () => onPackageChange('') }), h('span', null, h('strong', null, '自費付款'), h('small', null, '預約當日按服務收費。'))),
        ...packageOptions.map((item) => h('label', { className: 'booking-payment-option', key: item.id }, h('input', { type: 'radio', name: 'package', checked: String(state.customerPackageId) === String(item.id), onChange: () => onPackageChange(item.id) }), h('span', null, h('strong', null, item.packages?.name), h('small', null, `尚餘 ${item.sessions_remaining}/${item.total_sessions} 次`)))),
      )
  const blocked = currentPackageState.status === 'loading' || currentPackageState.status === 'error'
  return h('section', { 'aria-labelledby': 'booking-review-title' },
    h('h2', { id: 'booking-review-title', className: 'booking-wizard-title', ref: headingRef, tabIndex: -1 }, '確認預約'),
    h('dl', { className: 'booking-summary' },
      h('div', null, h('dt', null, '服務'), h('dd', null, service?.name)),
      h('div', null, h('dt', null, '服務員工'), h('dd', null, state.staffPreference === 'any' ? '任何可服務員工' : staff?.displayName)),
      h('div', null, h('dt', null, '時間'), h('dd', null, state.startsAt ? formatHongKongDateTime(state.startsAt) : '')),
      h('div', null, h('dt', null, '聯絡人'), h('dd', null, `${state.contact.name} · ${state.contact.phone}`)),
    ),
    payment,
    selectedPackage ? h('p', { className: 'booking-status' }, `將使用「${selectedPackage.packages?.name}」扣減一次。`) : null,
    h('label', { className: 'booking-terms' }, h('input', { type: 'checkbox', checked: state.acceptedTerms, onChange: (event) => onTermsChange(event.target.checked) }), h('span', null, '我已核對預約資料，並同意預約安排。')),
    h('button', { type: 'button', className: 'booking-primary', disabled: state.submitting || !state.acceptedTerms || blocked, onClick: onSubmit }, state.submitting ? '提交中…' : '確認預約'),
  )
}
