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

  const { data, error } = await context.db
    .from('app_settings')
    .update({
      data: merged,
      updated_by: context.auth.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select('data, updated_at, updated_by')
    .single()

  if (error) return jsonError(error)
  await audit(context.db, context.auth.user, 'app-settings.update', 'app_settings', 1, { keys: Object.keys(merged) })
  return NextResponse.json({ settings: mergeSettings(data?.data) })
}
