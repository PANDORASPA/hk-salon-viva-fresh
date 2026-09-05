import { NextResponse } from 'next/server'

const buckets = globalThis.__salonPokeRateLimitBuckets || new Map()
globalThis.__salonPokeRateLimitBuckets = buckets

const RATE_LIMIT_NAMESPACE = 'salon-poke:rate-limit'

const parseOrigin = (value) => {
  try {
    return value ? new URL(value).origin : ''
  } catch {
    return ''
  }
}

const requestOrigin = (request) => {
  try {
    return new URL(request.url).origin
  } catch {
    return ''
  }
}

const configuredOrigins = (request) => {
  const origins = new Set()
  const current = requestOrigin(request)
  const configured = parseOrigin(process.env.NEXT_PUBLIC_SITE_URL)
  if (current) origins.add(current)
  if (configured) origins.add(configured)
  return origins
}

export function requireSameOrigin(request) {
  const allowed = configuredOrigins(request)
  const origin = parseOrigin(request.headers.get('origin'))
  const referer = parseOrigin(request.headers.get('referer'))
  const presented = origin || referer

  if (!presented && process.env.NODE_ENV !== 'production') return null
  if (presented && allowed.has(presented)) return null

  return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 })
}

const rateLimitKey = (request, scope) => {
  const forwarded = String(request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  const realIp = String(request.headers.get('x-real-ip') || '').trim()
  const ip = forwarded || realIp || 'unknown'
  return `${RATE_LIMIT_NAMESPACE}:${scope}:${ip}`
}

const upstashConfigured = () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

const rateLimitWithUpstash = async (key, { limit, windowMs }) => {
  if (!upstashConfigured()) return null

  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000))
  const response = await fetch(`${String(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/, '')}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, ttlSeconds, 'NX'],
      ['TTL', key],
    ]),
    cache: 'no-store',
  })

  if (!response.ok) throw new Error(`Upstash rate limit failed: ${response.status}`)
  const payload = await response.json().catch(() => [])
  const count = Number(payload?.[0]?.result || 0)
  const ttl = Number(payload?.[2]?.result || ttlSeconds)
  return {
    limited: count > limit,
    retryAfter: Math.max(1, ttl || ttlSeconds),
  }
}

const rateLimitWithMemory = (key, { limit, windowMs }) => {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  bucket.count += 1
  if (bucket.count <= limit) return null

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  return { limited: true, retryAfter }
}

export async function rateLimit(request, { scope = 'global', limit = 30, windowMs = 60_000 } = {}) {
  const key = rateLimitKey(request, scope)
  let result = null

  try {
    result = await rateLimitWithUpstash(key, { limit, windowMs })
  } catch {
    result = null
  }

  result = result || rateLimitWithMemory(key, { limit, windowMs })
  if (!result?.limited) return null

  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter),
      },
    },
  )
}

export async function guardMutationRequest(request, options = {}) {
  const originError = requireSameOrigin(request)
  if (originError) return originError
  if (options.rateLimit) return await rateLimit(request, options.rateLimit)
  return null
}

export async function guardReadRequest(request, options = {}) {
  if (options.rateLimit) return await rateLimit(request, options.rateLimit)
  return null
}
