import { adminContext, jsonError, createRecordMutation, routeRecordId, retiredAdminMutation, manageAdminRecord } from '../../../../lib/admin/salon-api.js'

export async function GET() {
  const ctx=await adminContext(); if(ctx.response)return ctx.response
  const {data,error}=await ctx.db.from('customers').select('*, customer_packages(count)').order('created_at',{ascending:false}).limit(500)
  return error?jsonError(error):Response.json({customers:data||[]})
}
export const POST=createRecordMutation({kind:'customer',key:'customer',status:201})
