import React from 'react'

const h = React.createElement

export default function StaffStep({ staff, staffPreference, loading, error, onSelect, onRetry, headingRef }) {
  const choices = !loading && !error ? staff.map((person) => h('label', { className: 'booking-choice', key: person.id },
    h('input', {
      type: 'radio', name: 'staff-preference', value: person.id,
      checked: String(staffPreference) === String(person.id), onChange: () => onSelect(person.id),
    }),
    h('span', { className: 'booking-choice-name' }, person.displayName),
    person.bio ? h('span', { className: 'booking-choice-meta' }, person.bio) : null,
  )) : null
  return h('section', { 'aria-labelledby': 'booking-staff-title' },
    h('h2', { id: 'booking-staff-title', className: 'booking-wizard-title', ref: headingRef, tabIndex: -1 }, '選擇服務員工'),
    h('p', { className: 'booking-wizard-intro' }, '你可選擇指定員工，或交由我們安排任何可服務員工。'),
    h('fieldset', { className: 'booking-choice-grid', 'aria-busy': loading },
      h('legend', { className: 'booking-sr-only' }, '服務員工'),
      h('label', { className: 'booking-choice' },
        h('input', { type: 'radio', name: 'staff-preference', value: 'any', checked: staffPreference === 'any', onChange: () => onSelect('any') }),
        h('span', { className: 'booking-choice-name' }, '任何可服務員工'),
        h('span', { className: 'booking-choice-meta' }, '系統會為你安排可用員工'),
      ),
      choices,
    ),
    loading ? h('p', { className: 'booking-status', 'aria-live': 'polite' }, '正在載入可服務員工…') : null,
    error ? h('div', { className: 'booking-error', role: 'alert' }, error, h('button', { type: 'button', className: 'booking-secondary', onClick: onRetry }, '重新載入員工')) : null,
  )
}
