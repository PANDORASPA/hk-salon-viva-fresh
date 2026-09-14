import { NextResponse } from 'next/server.js'
import { revalidatePath } from 'next/cache.js'
import { adminContext, audit, jsonError } from '../../../../../../lib/admin/salon-api.js'
import { guardMutationRequest } from '../../../../../../lib/security/request-guards.js'
import { isPositiveSafeInteger, validateTimeOffInput } from '../../../../../../lib/validation/staff.js'

const parseId = async context => { const id = Number((await context.params).id); return isPositiveSafeInteger(id) ? id : null }
const toTimeOff = row => row && ({ id: row.id, staffId: row.staff_id, startsAt: row.starts_at, endsAt: row.ends_at, reason: row.reason, createdAt: row.created_at })
const commandError = error => {
  const message = String(error?.message || error || '')
  if (message.includes('invalid_staff_time_off')) return jsonError('Invalid time off.', 400)
  if (message.includes('staff_time_off_not_found')) return jsonError('Time off entry not found.', 404)
  return jsonError('Unable to save time off.', 500)
}

export function createStaffTimeOffHandlers({
  adminContext: resolveContext = adminContext,
  guardMutationRequest: guardMutation = guardMutationRequest,
  audit: writeAudit = audit,
  revalidatePath: revalidate = revalidatePath,
} = {}) {
  return {
    async GET(_request, routeContext) {
      const context = await resolveContext()
      if (context.response) return context.response
      const id = await parseId(routeContext)
      if (!id) return jsonError('Invalid staff.', 400)
      const { data, error } = await context.db.from('staff_time_off').select('id,staff_id,starts_at,ends_at,reason,created_at').eq('staff_id', id).order('starts_at')
      if (error) return jsonError('Unable to load time off.', 500)
      return NextResponse.json({ timeOff: (data || []).map(toTimeOff) })
    },
    async POST(request, routeContext) {
      const guard = await guardMutation(request, { rateLimit: { scope: 'admin.staff', limit: 30, windowMs: 60_000 } })
      if (guard) return guard
      const context = await resolveContext()
      if (context.response) return context.response
      const id = await parseId(routeContext)
      const parsed = validateTimeOffInput(await request.json().catch(() => null))
      if (!id || !parsed.ok) return jsonError('Invalid time off.', 400)
      const { data, error } = await context.db.rpc('admin_create_staff_time_off', {
        p_staff_id: id, p_starts_at: parsed.value.startsAt, p_ends_at: parsed.value.endsAt,
        p_reason: parsed.value.reason, p_created_by: context.auth.user.id,
      })
      if (error) return commandError(error)
      const timeOff = toTimeOff(data)
      await writeAudit(context.db, context.auth.user, 'staff.time_off.create', 'staff_time_off', data.id, { after: { staffId: id, ...parsed.value } })
      revalidate('/admin'); revalidate('/booking')
      return NextResponse.json({ timeOff }, { status: 201 })
    },
    async DELETE(request, routeContext) {
      const guard = await guardMutation(request, { rateLimit: { scope: 'admin.staff', limit: 30, windowMs: 60_000 } })
      if (guard) return guard
      const context = await resolveContext()
      if (context.response) return context.response
      const id = await parseId(routeContext)
      const timeOffId = Number(new URL(request.url).searchParams.get('id'))
      if (!id || !isPositiveSafeInteger(timeOffId)) return jsonError('Invalid time off.', 400)
      const { error } = await context.db.rpc('admin_delete_staff_time_off', { p_staff_id: id, p_time_off_id: timeOffId })
      if (error) return commandError(error)
      await writeAudit(context.db, context.auth.user, 'staff.time_off.delete', 'staff_time_off', timeOffId, { before: { staffId: id, id: timeOffId } })
      revalidate('/admin'); revalidate('/booking')
      return NextResponse.json({ success: true })
    },
  }
}

export async function GET(request, context) { return createStaffTimeOffHandlers().GET(request, context) }
export async function POST(request, context) { return createStaffTimeOffHandlers().POST(request, context) }
export async function DELETE(request, context) { return createStaffTimeOffHandlers().DELETE(request, context) }
