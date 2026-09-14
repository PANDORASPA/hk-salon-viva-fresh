import { adminContext, jsonError, createRecordMutation, routeRecordId, retiredAdminMutation, manageAdminRecord } from '../../../../../lib/admin/salon-api.js'

export async function GET(request,context) {
  const ctx=await adminContext(); if(ctx.response)return ctx.response
  const id=await routeRecordId(request,context); if(!Number.isSafeInteger(id)||id<1)return jsonError('記錄編號不正確。',400)
  const {data,error}=await ctx.db.from('customers').select('*, appointments(id,reference,starts_at,status), customer_packages(id,package_id,total_sessions,sessions_remaining,is_active,expires_at,packages(name,colour_hex),package_redemptions(id,redeemed_at,refunded_at))').eq('id',id).single()
  return error?jsonError(error):Response.json({customer:data})
}
export const PATCH=createRecordMutation({kind:'customer',key:'customer',idFrom:routeRecordId})
export const DELETE=retiredAdminMutation
