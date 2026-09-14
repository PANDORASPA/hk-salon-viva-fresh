'use client'

export default function StaffStep({ staff, staffPreference, loading, error, onSelect }) {
  return (
    <section aria-labelledby="booking-staff-title">
      <h2 id="booking-staff-title" className="booking-wizard-title">選擇服務員工</h2>
      <p className="booking-wizard-intro">你可選擇指定員工，或交由我們安排任何可服務員工。</p>
      <div className="booking-choice-grid" role="radiogroup" aria-label="服務員工" aria-busy={loading}>
        <button
          type="button"
          role="radio"
          aria-checked={staffPreference === 'any'}
          className={`booking-choice ${staffPreference === 'any' ? 'is-selected' : ''}`}
          onClick={() => onSelect('any')}
        >
          <span className="booking-choice-name">任何可服務員工</span>
          <span className="booking-choice-meta">系統會為你安排可用員工</span>
        </button>
        {staff.map((person) => {
          const selected = String(staffPreference) === String(person.id)
          return (
            <button
              key={person.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`booking-choice ${selected ? 'is-selected' : ''}`}
              onClick={() => onSelect(person.id)}
            >
              <span className="booking-choice-name">{person.displayName}</span>
              {person.bio && <span className="booking-choice-meta">{person.bio}</span>}
            </button>
          )
        })}
      </div>
      {loading && <p className="booking-status" aria-live="polite">正在載入可服務員工…</p>}
      {error && <p className="booking-error" role="alert">{error}</p>}
    </section>
  )
}
