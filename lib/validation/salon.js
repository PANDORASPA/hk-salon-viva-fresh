/**
 * Validation helpers for salon booking payloads.
 *
 * This module is imported from route handlers, so it also re-exports a few
 * Next.js + Supabase helpers. The Next.js imports are only needed at
 * runtime, not in unit tests, so we lazy-load them via a tiny CJS require
 * guard that no-ops when `next` is unavailable (i.e. under `node --test`).
 */
function runtimeImports() {
  if (runtimeImports._cache) return runtimeImports._cache
  const result = { NextResponse: null, requireAdmin: null, getServiceClient: null, guardMutationRequest: null }
  try {
    // eslint-disable-next-line global-require
    const nextServer = require('next/server')
    result.NextResponse = nextServer.NextResponse
  } catch {
    // next is not installed in test env — provide a tiny shim
    result.NextResponse = class FakeNextResponse {
      constructor(body, init = {}) { this.body = body; this.status = init.status || 200; this.headers = init.headers || {} }
      static json(value, init) { return new FakeNextResponse(JSON.stringify(value), { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } }) }
      static next() { return new FakeNextResponse('') }
    }
  }
  try {
    result.requireAdmin = require('../supabase/admin').requireAdmin
    result.getServiceClient = require('../supabase/service').getServiceClient
    result.guardMutationRequest = require('../security/request-guards').guardMutationRequest
  } catch {
    // modules not available outside Next.js runtime; provide no-op fallbacks
  }
  runtimeImports._cache = result
  return result
}

/**
 * Validate a public appointment booking payload.
 *
 * Returns `{ ok, value, errors }` so route handlers can either early-return on
 * `ok === false` or pass `value` (the normalised payload) downstream.
 *
 * Required fields: `serviceId`, `customerName`, `customerPhone`, `startsAt`.
 * Optional fields: `customerId`, `customerPackageId`, `customerEmail`, `notes`.
 *
 * The HK salon uses ISO-8601 `startsAt` (e.g. "2026-09-08T10:00") rather than
 * separate `date` + `time` fields.
 */
export function validateAppointmentInput(body) {
  const errors = []
  const value = body && typeof body === 'object' ? { ...body } : {}

  if (!value.serviceId || !Number.isSafeInteger(Number(value.serviceId))) {
    errors.push('serviceId')
  } else {
    value.serviceId = Number(value.serviceId)
  }
  if (!value.customerName || String(value.customerName).trim().length < 2) {
    errors.push('customerName')
  } else {
    value.customerName = String(value.customerName).trim()
  }
  if (!value.customerPhone || String(value.customerPhone).trim().length < 5) {
    errors.push('customerPhone')
  } else {
    value.customerPhone = String(value.customerPhone).trim()
  }
  if (!value.startsAt || Number.isNaN(new Date(value.startsAt).getTime())) {
    errors.push('startsAt')
  }
  if (value.customerId != null && value.customerId !== '' && !Number.isSafeInteger(Number(value.customerId))) {
    errors.push('customerId')
  } else if (value.customerId != null && value.customerId !== '') {
    value.customerId = Number(value.customerId)
  }
  if (value.customerPackageId != null && value.customerPackageId !== '' && !Number.isSafeInteger(Number(value.customerPackageId))) {
    errors.push('customerPackageId')
  } else if (value.customerPackageId != null && value.customerPackageId !== '') {
    value.customerPackageId = Number(value.customerPackageId)
  }
  if (value.customerEmail != null && value.customerEmail !== '') {
    value.customerEmail = String(value.customerEmail).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.customerEmail)) errors.push('customerEmail')
  }
  if (value.notes != null && value.notes !== '') {
    const trimmed = String(value.notes)
    if (trimmed.length > 2000) {
      errors.push('notes')
    } else {
      value.notes = trimmed
    }
  }

  return { ok: errors.length === 0, errors, value }
}

const { NextResponse, requireAdmin, getServiceClient, guardMutationRequest } = runtimeImports()
export { NextResponse, requireAdmin, getServiceClient, guardMutationRequest }

export default { validateAppointmentInput, NextResponse, requireAdmin, getServiceClient, guardMutationRequest }
