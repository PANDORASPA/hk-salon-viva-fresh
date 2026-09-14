import { NextResponse } from 'next/server'
import { adminContext, audit, jsonError } from '../../../../lib/admin/salon-api'
import { guardMutationRequest } from '../../../../lib/security/request-guards'
import { mergeSettings, readAppSettings } from '../../../../lib/settings/app-settings'

export async function GET() {
  const context = await adminContext()
  if (context.response) return context.response
  const settings = await readAppSettings(context.db)
  return NextResponse.json({ settings })
}

export async function PATCH(request) {
  const guard = await guardMutationRequest(request, {
    rateLimit: { scope: 'admin.settings', limit: 20, windowMs: 60_000 },
  })
  if (guard) return guard

  const context = await adminContext()
  if (context.response) return context.response

  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON body.', 400)
  }

  const incoming = body?.settings
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return jsonError('settings object required.', 400)
  }
  const merged = mergeSettings(incoming)

  const { data, error } = await context.db.rpc('admin_save_settings', { p_actor_id: context.auth.user.id, p_data: merged })

  if (error) return jsonError(error)
  return NextResponse.json({ settings: mergeSettings(data?.data) })
}
