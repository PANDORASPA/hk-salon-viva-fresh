import { adminContext, jsonError, createRecordMutation, routeRecordId, retiredAdminMutation, manageAdminRecord } from '../../../../../lib/admin/salon-api.js'

import { guardMutationRequest } from '../../../../../lib/security/request-guards.js'
import { applyPackageAdjustment } from '../../../../../lib/admin/package-adjustment.js'
export async function GET(request,context) {
  const ctx=await adminContext(); if(ctx.response)return ctx.response
  const id=await routeRecordId(request,context); if(!Number.isSafeInteger(id)||id<1)return jsonError('記錄編號不正確。',400)
  const {data,error}=await ctx.db.from('customer_packages').select('*,customers(name,phone),packages(name,colour_hex)').eq('id',id).single()
  return error?jsonError(error):Response.json({customerPackage:data})
}
export async function PATCH(request,context) {
  const guard=await guardMutationRequest(request,{rateLimit:{scope:'admin.customer-packages',limit:30,windowMs:60_000}}); if(guard)return guard
  const ctx=await adminContext(); if(ctx.response)return ctx.response
  try {
    const id=await routeRecordId(request,context), body=await request.json()
    if(body.adjustment!==undefined) {
      if(Object.keys(body).some(key=>!['adjustment','reason'].includes(key)))return jsonError('資料格式不正確。',400)
      return Response.json({customerPackage:await applyPackageAdjustment(ctx.db,ctx.auth.user.id,{id,...body})})
    }
    return Response.json({customerPackage:await manageAdminRecord(ctx,'customer_package',id,body)})
  } catch(error) { return jsonError(error,400) }
}
export const DELETE=retiredAdminMutation
