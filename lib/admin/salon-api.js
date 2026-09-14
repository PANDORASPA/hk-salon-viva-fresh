import { NextResponse } from 'next/server.js'
import { requireAdmin } from '../supabase/admin.js'
import { getServiceClient } from '../supabase/service.js'
import { guardMutationRequest } from '../security/request-guards.js'
import { validateCustomerInput } from '../validation/customer.js'

export async function adminContext() {
  const auth = await requireAdmin()
  if (auth.error) return { response:NextResponse.json({ error:auth.error },{ status:auth.status }) }
  return { auth, db:getServiceClient() }
}

export async function audit(db,user,action,entityType,entityId,metadata={}) {
  const { error } = await db.from('admin_audit_logs').insert({ actor_id:user.id, actor_user_id:user.id, action, entity_type:entityType, target_table:entityType, entity_id:entityId == null ? null : String(entityId), target_id:entityId == null ? null : String(entityId), metadata })
  if (error) throw error
}

export const jsonError = (error,status=500) => NextResponse.json({ error:error?.message || String(error) },{ status })

const positive = n => Number.isSafeInteger(n) && n > 0
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value
function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('資料格式不正確。')
}
export function validateAdminRecord(kind, value) {
  if (kind === 'customer') return validateCustomerInput(value, { admin: true })
  if (kind === 'issue_package') {
    fields(value, ['customerId','packageId','reason','requestKey'])
    if (!positive(value.customerId) || !positive(value.packageId) || typeof value.reason !== 'string' || !value.reason.trim() || value.reason.length>500 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestKey || '')) throw new Error('請選擇客戶及套票，並填寫派發原因。')
    return { ...value, reason: value.reason.trim() }
  }
  if (['customer_package','package_state'].includes(kind)) {
    fields(value, kind === 'customer_package' ? ['isActive','reason'] : ['isActive'])
    if (typeof value.isActive !== 'boolean' || (kind==='customer_package' && (typeof value.reason !== 'string' || !value.reason.trim() || value.reason.length>500))) throw new Error('請填寫有效狀態及原因。')
  } else if (kind === 'closure') {
    fields(value, ['startsOn','endsOn','reason'])
    if (!day(value.startsOn) || !day(value.endsOn) || value.endsOn<value.startsOn || typeof value.reason!=='string' || value.reason.length>240) throw new Error('請輸入有效的休息日期。')
  } else if (kind === 'schedule_hours') {
    fields(value, ['hours'])
    if (!Array.isArray(value.hours) || value.hours.length!==7 || new Set(value.hours.map(row=>row.weekday)).size!==7) throw new Error('請設定完整七天營業時間。')
    value = { hours: value.hours.map(row=>{
      fields(row,['weekday','is_open','opens_at','closes_at','updated_at'])
      if (!Number.isInteger(row.weekday) || row.weekday<0 || row.weekday>6 || typeof row.is_open!=='boolean') throw new Error('營業時間格式不正確。')
      const opens = row.opens_at?.slice(0,5), closes = row.closes_at?.slice(0,5)
      if (row.is_open && (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(opens) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(closes) || opens>=closes)) throw new Error('結束時間必須晚於開始時間。')
      return { weekday:row.weekday,is_open:row.is_open,opens_at:row.is_open?opens:null,closes_at:row.is_open?closes:null }
    }) }
  } else if (kind.startsWith('gallery_') && kind !== 'gallery_delete') {
    fields(value,kind==='gallery_create'?['storagePath','altText','caption','published','sortOrder']:['altText','caption','published','sortOrder'])
    if (typeof value.altText!=='string' || !value.altText.trim() || value.altText.length>240 || typeof value.caption!=='string' || value.caption.length>240 || typeof value.published!=='boolean' || !Number.isSafeInteger(value.sortOrder) || Math.abs(value.sortOrder)>100000) throw new Error('請檢查圖片說明及排序。')
  } else if (['gallery_delete','closure_delete'].includes(kind)) fields(value,[])
  else if (!['customer_package','package_state'].includes(kind)) throw new Error('不支援的操作。')
  return value
}

export async function manageAdminRecord(context, kind, id, body) {
  if (id != null && !positive(id)) throw new Error('記錄編號不正確。')
  const value = validateAdminRecord(kind, body)
  const { data, error } = await context.db.rpc('admin_manage_record', { p_actor_id: context.auth.user.id, p_kind: kind, p_id: id, p_data: value })
  if (error) throw new Error(({ B0003: '請先讓客戶登入綁定帳戶，再派發套票。', B0043: '找不到指定記錄。', B0031: '請填寫操作原因。', '23505': '電話或記錄已存在，請檢查後重試。' })[error.code] || '未能儲存；所有變更已撤回。請檢查資料後重試。')
  return data
}

export function createRecordMutation({ kind, key, status=200, idFrom=async()=>null, transform=value=>value, adminContext: context=adminContext, guardMutationRequest: guard=guardMutationRequest }={}) {
  return async (request, routeContext) => {
    const denied=await guard(request,{rateLimit:{scope:`admin.${kind}`,limit:30,windowMs:60_000}})
    if (denied) return denied
    const ctx=await context(); if(ctx.response) return ctx.response
    try {
      const row=await manageAdminRecord(ctx,kind,await idFrom(request,routeContext),transform(await request.json()))
      return Response.json({[key]:row},{status})
    } catch(error) { return jsonError(error,400) }
  }
}
export const routeRecordId = async (_request,context) => Number((await context.params).id)
export function createRetiredAdminMutation({guardMutationRequest:guard=guardMutationRequest,adminContext:resolveContext=adminContext}={}) {
  return async request=>{
    const denied=await guard(request,{rateLimit:{scope:'admin.retired',limit:15,windowMs:60_000}})
    if(denied)return denied
    const context=await resolveContext();if(context.response)return context.response
    return Response.json({error:'operation_retired',message:'此舊操作已停用，請使用經審計的管理功能。'},{status:410})
  }
}
export const retiredAdminMutation=createRetiredAdminMutation()
