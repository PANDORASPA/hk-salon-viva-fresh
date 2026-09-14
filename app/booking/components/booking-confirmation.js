export function confirmationUrl({ appointment, confirmationToken }) {
  const id = appointment?.id
  if (!id || !confirmationToken) return '/booking/confirm'
  return `/booking/confirm?id=${encodeURIComponent(id)}&token=${encodeURIComponent(confirmationToken)}`
}
