import { NextResponse } from 'next/server.js'
import { revalidatePath } from 'next/cache.js'
import { adminContext, jsonError } from '../../../../../../lib/admin/salon-api.js'
import { guardMutationRequest } from '../../../../../../lib/security/request-guards.js'
import { isPositiveSafeInteger, validateWeeklyHours } from '../../../../../../lib/validation/staff.js'

const parseId = async context => { const id = Number((await context.params).id); return isPositiveSafeInteger(id) ? id : null }
const commandError = error => String(error?.message || error || '').includes('invalid_staff_weekly_hours')
  ? jsonError('Invalid weekly hours.', 400) : jsonError('Unable to save weekly hours.', 500)
const dbHours = hours => hours.map(row => ({ weekday: row.weekday, isWorking: row.isWorking, startsAt: row.startsAt, endsAt: row.endsAt }))

export function createStaffHoursHandlers({
  adminContext: resolveContext = adminContext,
  guardMutationRequest: guardMutation = guardMutationRequest,
  revalidatePath: revalidate = revalidatePath,
} = {}) {
  const replace = async (request, routeContext) => {
    const guard = await guardMutation(request, { rateLimit: { scope: 'admin.staff', limit: 30, windowMs: 60_000 } })
    if (guard) return guard
    const context = await resolveContext()
    if (context.response) return context.response
    const id = await parseId(routeContext)
    const parsed = validateWeeklyHours((await request.json().catch(() => null))?.hours)
    if (!id || !parsed.ok) return jsonError('Invalid weekly hours.', 400)
    const { data, error } = await context.db.rpc('admin_replace_staff_weekly_hours_audited', { p_actor_id: context.auth.user.id, p_staff_id: id, p_hours: dbHours(parsed.value) })
    if (error) return commandError(error)
    revalidate('/admin'); revalidate('/booking')
    return NextResponse.json({ hours: data || parsed.value })
  }
  return { PUT: replace, POST: replace }
}

export async function PUT(request, context) { return createStaffHoursHandlers().PUT(request, context) }
export async function POST(request, context) { return createStaffHoursHandlers().POST(request, context) }
