'use client'

function price(service) {
  return `HK$${(Number(service.price || 0) / 100).toFixed(0)}`
}

export default function ServiceStep({ services, selectedServiceId, onSelect }) {
  return (
    <section aria-labelledby="booking-service-title">
      <h2 id="booking-service-title" className="booking-wizard-title">選擇服務</h2>
      <p className="booking-wizard-intro">先選擇今次想預約的服務。</p>
      <div className="booking-choice-grid" role="radiogroup" aria-label="服務">
        {services.map((service) => {
          const selected = String(selectedServiceId) === String(service.id)
          return (
            <button
              key={service.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`booking-choice ${selected ? 'is-selected' : ''}`}
              onClick={() => onSelect(service.id)}
            >
              <span className="booking-choice-name">{service.name}</span>
              <span className="booking-choice-meta">{service.duration_minutes}分鐘 · {price(service)}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
