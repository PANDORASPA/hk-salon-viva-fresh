'use client'

export default function TimeStep({ date, minDate, slots, selectedSlot, loading, message, onDateChange, onSelect }) {
  return (
    <section aria-labelledby="booking-time-title">
      <h2 id="booking-time-title" className="booking-wizard-title">選擇日期及時間</h2>
      <div className="booking-field">
        <label htmlFor="booking-date">日期</label>
        <input id="booking-date" type="date" value={date} min={minDate} onChange={(event) => onDateChange(event.target.value)} />
      </div>
      <p className="booking-status" aria-live="polite">
        {loading ? '正在載入可預約時段…' : message}
      </p>
      {!loading && slots.length > 0 && (
        <div className="booking-slot-grid" role="radiogroup" aria-label="可預約時段">
          {slots.map((slot) => {
            const selected = selectedSlot === slot.iso
            return (
              <button
                key={slot.iso}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`booking-slot ${selected ? 'is-selected' : ''}`}
                onClick={() => onSelect(slot.iso)}
              >
                {slot.label}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
