import { NextResponse } from 'next/server'
import { adminContext, audit, jsonError } from '../../../../../lib/admin/salon-api'

export async function POST(request) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const body = await request.json()
  const { package_id, service_id } = body
  if (!package_id || !service_id) return jsonError('package_id and service_id required', 400)
  const { data, error } = await ctx.db
    .from('package_services')
    .insert({ package_id: Number(package_id), service_id: Number(service_id) })
    .select()
    .single()
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'package_service.link', 'package_services', data.id)
  return NextResponse.json({ package_service: data }, { status: 201 })
}

export async function DELETE(request) {
  const ctx = await adminContext()
  if (ctx.response) return ctx.response
  const { searchParams } = new URL(request.url)
  const package_id = Number(searchParams.get('package_id'))
  const service_id = Number(searchParams.get('service_id'))
  if (!package_id || !service_id) return jsonError('package_id and service_id required', 400)
  const { error } = await ctx.db
    .from('package_services')
    .delete()
    .eq('package_id', package_id)
    .eq('service_id', service_id)
  if (error) return jsonError(error)
  await audit(ctx.db, ctx.auth.user, 'package_service.unlink', 'package_services', null, { package_id, service_id })
  return NextResponse.json({ success: true })
}
