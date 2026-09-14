export const initialBookingState = {
  step: 1,
  serviceId: '',
  staffPreference: 'any',
  date: '',
  startsAt: '',
  contact: { name: '', phone: '', email: '' },
  customerPackageId: '',
  acceptedTerms: false,
  submitting: false,
  error: '',
}

export function bookingReducer(state, action) {
  switch (action.type) {
    case 'SELECT_SERVICE':
      return { ...state, serviceId: action.serviceId, staffPreference: 'any', startsAt: '', customerPackageId: '', error: '' }
    case 'SELECT_STAFF':
      return { ...state, staffPreference: action.staffPreference, startsAt: '', error: '' }
    case 'SELECT_SLOT':
      return { ...state, date: action.date, startsAt: action.startsAt, error: '' }
    case 'PREFILL_CONTACT':
      return state.contactEdited ? state : { ...state, contact: { ...state.contact, ...action.contact } }
    case 'SET_CONTACT':
      return {
        ...state,
        contact: { ...state.contact, ...(action.contact || {}) },
        contactEdited: state.contactEdited || Boolean(action.contact),
        ...(typeof action.acceptedTerms === 'boolean' ? { acceptedTerms: action.acceptedTerms } : {}),
        error: '',
      }
    case 'SELECT_PACKAGE':
      return { ...state, customerPackageId: action.customerPackageId || '', error: '' }
    case 'BACK':
      return { ...state, step: Math.max(1, state.step - 1), error: '' }
    case 'NEXT':
      return { ...state, step: Math.min(5, state.step + 1), error: '' }
    case 'SUBMIT_START':
      return { ...state, submitting: true, error: '' }
    case 'SUBMIT_ERROR':
      return { ...state, submitting: false, error: action.error || '預約失敗，請稍後再試。', conflict: action.status === 409 }
    case 'SLOT_CONFLICT':
      return { ...state, step: 3, startsAt: '', submitting: false, conflict: true, error: action.error || '這個時段剛被預約，請選擇另一個時間。' }
    default:
      return state
  }
}
