import { NextResponse } from 'next/server'
import { requireAdmin } from '../../supabase/admin'
import { getServiceClient } from '../../supabase/service'
import { guardMutationRequest } from '../../security/request-guards'

export async function validateAppointmentInput(body) {
  const errors = []
  if (!body.serviceId || !Number.isSafeInteger(Number(body.serviceId))) errors.push('serviceId')
  if (!body.customerName || body.customerName.trim().length < 2) errors.push('customerName')
  if (!body.customerPhone || body.customerPhone.trim().length < 5) errors.push('customerPhone')
  if (!body.startsAt || Number.isNaN(new Date(body.startsAt).getTime())) errors.push('startsAt')
  if (body.customerId && !Number.isSafeInteger(Number(body.customerId))) errors.push('customerId')
  if (body.customerPackageId && !Number.isSafeInteger(Number(body.customerPackageId))) errors.push('customerPackageId')
  return errors
}

export { NextResponse, requireAdmin, getServiceClient, guardMutationRequest }
