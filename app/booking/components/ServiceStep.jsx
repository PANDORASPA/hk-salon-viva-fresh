'use client'

function price(service) {
  return `HK$${(Number(service.price || 0) / 100).toFixed(0)}`
}

export default function ServiceStep({ services, selectedServiceId, onSelect, headingRef }) {
  return (
    <section aria-labelledby="booking-service-title">
      <h2 id="booking-service-title" className="booking-wizard-title" ref={headingRef} tabIndex="-1">選擇服務</h2>
      <p className="booking-wizard-intro">先選擇今次想預約的服務。</p>
      <fieldset className="booking-choice-grid">
        <legend className="booking-sr-only">服務</legend>
        {services.map((service) => {
          const selected = String(selectedServiceId) === String(service.id)
          return (
            <label
              key={service.id}
              className={`booking-choice ${selected ? 'is-selected' : ''}`}
            >
              <input type="radio" name="service" value={service.id} checked={selected} onChange={() => onSelect(service.id)} />
              <span className="booking-choice-name">{service.name}</span>
              <span className="booking-choice-meta">{service.duration_minutes}分鐘 · {price(service)}</span>
            </label>
          )
        })}
      </fieldset>
    </section>
  )
}
