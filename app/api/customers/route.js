// Public contact searches are retired. Identity-bound reads use /customers/me.
export async function GET() {
  return Response.json({ error: 'endpoint_removed' }, { status: 410, headers: { 'Cache-Control': 'no-store' } })
}
