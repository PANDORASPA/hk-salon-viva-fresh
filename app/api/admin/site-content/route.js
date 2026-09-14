import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { adminContext,audit,jsonError } from '../../../../lib/admin/salon-api'
import { guardMutationRequest } from '../../../../lib/security/request-guards'
export async function GET(){const context=await adminContext();if(context.response)return context.response;const {data,error}=await context.db.from('site_content').select('data,updated_at').eq('id',1).single();return error?jsonError(error):NextResponse.json({content:data})}
export async function PATCH(request){const guard=await guardMutationRequest(request,{rateLimit:{scope:'admin.site-content',limit:20,windowMs:60_000}});if(guard)return guard;const context=await adminContext();if(context.response)return context.response;const body=await request.json(),data=body?.data;if(!data||Array.isArray(data)||typeof data!=='object'||JSON.stringify(data).length>50000)return jsonError('Invalid site content.',400);const {data:row,error}=await context.db.rpc('admin_save_site_content',{p_actor_id:context.auth.user.id,p_data:data});if(error)return jsonError(error,400);revalidatePath('/','layout');return NextResponse.json({content:row})}
