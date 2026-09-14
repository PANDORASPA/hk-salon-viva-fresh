import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_NAMESPACE = 'e2e_booking_platform'

export function preflightFailure(message) { return new Error(`E2E preflight refused: ${message}`) }

function required(env, name) {
  const value = env[name]
  if (!value) throw preflightFailure(`${name} is required`)
  return value
}

function hostFrom(url) { return url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '') }
function loopback(host) { return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host) }
function e2eHost(host) { return /(^|[.-])(e2e|test)([.-]|$)/.test(host) }

export function canonicalE2EUrl(name, value) {
  let url
  try { url = new URL(String(value).trim()) } catch { throw preflightFailure(`${name} must be an absolute URL`) }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw preflightFailure(`${name} must be a credential-free http(s) URL`)
  const host = hostFrom(url)
  if (!host) throw preflightFailure(`${name} has no host`)
  if (host === 'vercel.app' || host.endsWith('.vercel.app')) throw preflightFailure(`${name} targets a Vercel deployment`)
  if (/(^|[.-])(prod|production|preview)([.-]|$)/.test(host)) throw preflightFailure(`${name} targets a production or preview host`)
  if (!loopback(host) && !e2eHost(host)) throw preflightFailure(`${name} is not localhost or an explicitly named e2e/test host`)
  url.hostname = host.includes(':') ? `[${host}]` : host
  return { url, host, origin: url.origin }
}

export function bindingFor(marker, supabaseOrigin) {
  return createHash('sha256').update(`${marker}\u0000${supabaseOrigin}`).digest('base64url')
}

export function loadE2EEnvironment({ env = process.env, cwd = process.cwd(), text } = {}) {
  const source = text ?? (existsSync(resolve(cwd, '.env.e2e.local')) ? readFileSync(resolve(cwd, '.env.e2e.local'), 'utf8') : '')
  const loaded = []
  for (const original of source.split(/\r?\n/)) {
    const line = original.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, raw] = match
    let value = raw.trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!Object.hasOwn(env, key) || !env[key]) { env[key] = value; loaded.push(key) }
  }
  return loaded
}

export function e2eConfig(env = process.env) {
  const namespace = env.E2E_NAMESPACE || DEFAULT_NAMESPACE
  if (!/^[a-z][a-z0-9_]{2,48}$/.test(namespace)) throw preflightFailure('E2E_NAMESPACE must be a lowercase namespace')
  const password = required(env, 'E2E_TEST_PASSWORD')
  if (password.length < 12) throw preflightFailure('E2E_TEST_PASSWORD must be at least 12 characters')
  return {
    namespace,
    password,
    baseURL: canonicalE2EUrl('E2E_BASE_URL', required(env, 'E2E_BASE_URL')),
    supabaseUrl: canonicalE2EUrl('E2E_SUPABASE_URL', required(env, 'E2E_SUPABASE_URL')),
    serviceRoleKey: required(env, 'E2E_SUPABASE_SERVICE_ROLE_KEY'),
    databaseMarker: required(env, 'E2E_DATABASE_MARKER'),
    customerEmail: env.E2E_CUSTOMER_EMAIL || `${namespace}.customer@example.test`,
    adminEmail: env.E2E_ADMIN_EMAIL || `${namespace}.admin@example.test`,
  }
}

export async function verifyDatabaseMarker(db, marker) {
  const { data, error } = await db.from('app_settings').select('data').eq('id', 1).maybeSingle()
  if (error || data?.data?.e2e_marker !== marker) throw preflightFailure('Supabase database marker did not match')
  return data.data
}

export async function runE2ERuntimePreflight({ env = process.env, createServiceClient = createClient, fetchImpl = fetch } = {}) {
  loadE2EEnvironment({ env })
  const config = e2eConfig(env)
  const db = createServiceClient(config.supabaseUrl.origin, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const settings = await verifyDatabaseMarker(db, config.databaseMarker)
  let response
  try { response = await fetchImpl(new URL('/api/e2e', config.baseURL.origin), { redirect: 'error', cache: 'no-store' }) }
  catch { throw preflightFailure('application E2E probe could not be reached') }
  if (!response.ok) throw preflightFailure('application E2E probe is unavailable')
  const probe = await response.json().catch(() => null)
  if (!probe?.e2e || probe.binding !== bindingFor(config.databaseMarker, config.supabaseUrl.origin)) throw preflightFailure('application binding does not match the marked Supabase database')
  return { config, db, settings }
}
