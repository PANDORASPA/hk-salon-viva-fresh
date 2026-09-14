'use client'

function usablePackages(packages) {
  const now = Date.now()
  return packages.filter((item) => item.is_active && item.sessions_remaining > 0 && new Date(item.expires_at).getTime() > now)
}

export default function ReviewStep({ state, service, staff, packages, authenticated, onPackageChange, onTermsChange, onSubmit }) {
  const packageOptions = authenticated ? usablePackages(packages) : []
  const selectedPackage = packageOptions.find((item) => String(item.id) === String(state.customerPackageId))
  return (
    <section aria-labelledby="booking-review-title">
      <h2 id="booking-review-title" className="booking-wizard-title">確認預約</h2>
      <dl className="booking-summary">
        <div><dt>服務</dt><dd>{service?.name}</dd></div>
        <div><dt>服務員工</dt><dd>{state.staffPreference === 'any' ? '任何可服務員工' : staff?.displayName}</dd></div>
        <div><dt>時間</dt><dd>{state.startsAt ? new Date(state.startsAt).toLocaleString('zh-HK', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</dd></div>
        <div><dt>聯絡人</dt><dd>{state.contact.name} · {state.contact.phone}</dd></div>
      </dl>
      <fieldset className="booking-payment">
        <legend>付款方式</legend>
        <label className="booking-payment-option">
          <input type="radio" name="package" checked={!state.customerPackageId} onChange={() => onPackageChange('')} />
          <span><strong>自費付款</strong><small>預約當日按服務收費。</small></span>
        </label>
        {packageOptions.map((item) => (
          <label className="booking-payment-option" key={item.id}>
            <input type="radio" name="package" checked={String(state.customerPackageId) === String(item.id)} onChange={() => onPackageChange(item.id)} />
            <span><strong>{item.packages?.name}</strong><small>尚餘 {item.sessions_remaining}/{item.total_sessions} 次</small></span>
          </label>
        ))}
      </fieldset>
      {selectedPackage && <p className="booking-status">將使用「{selectedPackage.packages?.name}」扣減一次。</p>}
      <label className="booking-terms">
        <input type="checkbox" checked={state.acceptedTerms} onChange={(event) => onTermsChange(event.target.checked)} />
        <span>我已核對預約資料，並同意預約安排。</span>
      </label>
      <button type="button" className="booking-primary" disabled={state.submitting || !state.acceptedTerms} onClick={onSubmit}>
        {state.submitting ? '提交中…' : '確認預約'}
      </button>
    </section>
  )
}
