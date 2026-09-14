const BOOKING_ERRORS = Object.freeze({
  slot_unavailable: Object.freeze({
    status: 409,
    code: 'slot_unavailable',
    message: '這個時段剛被預約，請選擇另一個時間。',
  }),
  staff_unavailable: Object.freeze({
    status: 409,
    code: 'staff_unavailable',
    message: '所選員工暫時未能提供這個時段，請重新選擇。',
  }),
  package_not_usable: Object.freeze({
    status: 400,
    code: 'package_not_usable',
    message: '這張套票暫時不能用於此預約。',
  }),
  authentication_required: Object.freeze({
    status: 401,
    code: 'authentication_required',
    message: '請先登入再繼續。',
  }),
  ownership_forbidden: Object.freeze({ status: 403, code: 'ownership_forbidden', message: '你沒有權限更改這項預約或使用這張套票。' }),
  service_unavailable: Object.freeze({ status: 400, code: 'service_unavailable', message: '這項服務暫時未能預約。' }),
  booking_not_found: Object.freeze({ status: 404, code: 'booking_not_found', message: '找不到這項預約。' }),
  booking_not_changeable: Object.freeze({ status: 400, code: 'booking_not_changeable', message: '這項預約現時無法更改。' }),
  late_cancellation: Object.freeze({ status: 400, code: 'late_cancellation', message: '已過取消預約的期限，請聯絡本店。' }),
  booking_window_invalid: Object.freeze({
    status: 400,
    code: 'booking_window_invalid',
    message: '這個日期不在可預約範圍內。',
  }),
  validation_error: Object.freeze({
    status: 400,
    code: 'validation_error',
    message: '請檢查輸入資料。',
  }),
  availability_unavailable: Object.freeze({
    status: 503,
    code: 'availability_unavailable',
    message: '暫時無法載入預約資料，請稍後再試。',
  }),
  internal_error: Object.freeze({
    status: 500,
    code: 'internal_error',
    message: '系統暫時未能處理要求，請稍後再試。',
  }),
})

export function toBookingHttpError(code) {
  const value = BOOKING_ERRORS[code] || BOOKING_ERRORS.internal_error
  return { ...value }
}
