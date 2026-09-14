// No fulfilled response until a canonical entitlement can be issued atomically.
export async function POST() {
  return Response.json({ error: 'payments_unavailable', message: '網上付款尚未啟用。' }, { status: 503 })
}
