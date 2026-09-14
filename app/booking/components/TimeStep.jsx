'use client'

export default function TimeStep({ date, minDate, slots, selectedSlot, loading, message, onDateChange, onSelect, headingRef }) {
  return (
    <section aria-labelledby="booking-time-title">
      <h2 id="booking-time-title" className="booking-wizard-title" ref={headingRef} tabIndex="-1">選擇日期及時間</h2>
      <div className="booking-field">
        <label htmlFor="booking-date">日期</label>
        <input id="booking-date" type="date" value={date} min={minDate} onChange={(event) => onDateChange(event.target.value)} />
      </div>
      <p className="booking-status" aria-live="polite">
        {loading ? '正在載入可預約時段…' : message}
      </p>
      {!loading && slots.length > 0 && (
        <fieldset className="booking-slot-grid">
          <legend className="booking-sr-only">可預約時段</legend>
          {slots.map((slot) => {
            const selected = selectedSlot === slot.iso
            return (
              <label
                key={slot.iso}
                className={`booking-slot ${selected ? 'is-selected' : ''}`}
              >
                <input type="radio" name="time-slot" value={slot.iso} checked={selected} onChange={() => onSelect(slot.iso)} />
                {slot.label}
              </label>
            )
          })}
        </fieldset>
      )}
    </section>
  )
}
