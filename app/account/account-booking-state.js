export function accountBookingsReducer(state, action) {
  switch (action.type) {
    case 'SERVER_REFRESH':
      return action.bookings
    case 'BOOKING_UPDATED':
      return state.map((booking) => booking.id === action.booking.id ? action.booking : booking)
    default:
      return state
  }
}
