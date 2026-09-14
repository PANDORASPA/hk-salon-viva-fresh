import { adminContext, jsonError, createRecordMutation, routeRecordId, retiredAdminMutation, manageAdminRecord } from '../../../../lib/admin/salon-api.js'

export async function GET() {
  const ctx=await adminContext(); if(ctx.response)return ctx.response
  const {data,error}=await ctx.db.from('customer_packages').select('*,customers(name,phone),packages(name,colour_hex)').order('purchased_at',{ascending:false}).limit(500)
  return error?jsonError(error):Response.json({customerPackages:data||[]})
}
export const POST=createRecordMutation({kind:'issue_package',key:'customerPackage',status:201})
