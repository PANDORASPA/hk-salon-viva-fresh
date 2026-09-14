import { adminContext, jsonError, manageAdminRecord } from '../../../../lib/admin/salon-api.js'
import { guardMutationRequest } from '../../../../lib/security/request-guards.js'

export function createAdminScheduleHandlers({ adminContext: resolveContext=adminContext, guardMutationRequest: guard=guardMutationRequest }={}) {
  async function context(request) {
    const denied=await guard(request,{rateLimit:{scope:'admin.schedule',limit:30,windowMs:60_000}})
    return denied ? {response:denied} : resolveContext()
  }
  return {
    async GET() {
      const ctx=await resolveContext(); if(ctx.response)return ctx.response
      const [hours,blocks]=await Promise.all([ctx.db.from('business_hours').select('*').order('weekday'),ctx.db.from('blocked_dates').select('*').order('starts_on')])
      return hours.error||blocks.error?jsonError('未能載入營業時間。'):Response.json({hours:hours.data||[],blockedDates:blocks.data||[]})
    },
    async POST(request) {
      const ctx=await context(request); if(ctx.response)return ctx.response
      try {
        const {type,...body}=await request.json()
        if(type==='hours') return Response.json({hours:await manageAdminRecord(ctx,'schedule_hours',null,body)})
        if(type!=='closure') return jsonError('請選擇有效的時間操作。',400)
        return Response.json({blockedDate:await manageAdminRecord(ctx,'closure',null,body)},{status:201})
      } catch(error) { return jsonError(error,400) }
    },
    async DELETE(request) {
      const ctx=await context(request); if(ctx.response)return ctx.response
      try { await manageAdminRecord(ctx,'closure_delete',Number(new URL(request.url).searchParams.get('id')),{}); return Response.json({success:true}) } catch(error) { return jsonError(error,400) }
    },
  }
}
const handlers=createAdminScheduleHandlers()
export const GET=handlers.GET
export const POST=handlers.POST
export const DELETE=handlers.DELETE
