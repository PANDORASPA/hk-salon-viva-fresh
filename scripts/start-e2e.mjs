import { spawn as nodeSpawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { canonicalE2EUrl, e2eConfig, loadE2EEnvironment, preflightFailure } from '../lib/e2e/runtime-preflight.mjs'

const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url))
const isLoopback = host => host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host)

export function createE2ELauncher({ env = process.env, cwd = process.cwd(), spawn = nodeSpawn } = {}) {
  loadE2EEnvironment({ env, cwd })
  const config = e2eConfig(env)
  if (!isLoopback(config.baseURL.host)) throw preflightFailure('E2E_BASE_URL must be a local loopback URL when launching Next dev')
  if (config.baseURL.url.protocol !== 'http:') throw preflightFailure('E2E_BASE_URL must use http for ordinary Next dev')
  if (env.E2E_PROBE_ENABLED !== '1') throw preflightFailure('E2E_PROBE_ENABLED=1 is required for the local E2E app')
  if (env.NODE_ENV === 'production' || ['production', 'preview'].includes(env.VERCEL_ENV)) throw preflightFailure('the E2E launcher cannot run a production or preview runtime')
  const publicSupabase = canonicalE2EUrl('NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL || '')
  if (publicSupabase.origin !== config.supabaseUrl.origin) throw preflightFailure('NEXT_PUBLIC_SUPABASE_URL must match E2E_SUPABASE_URL')
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw preflightFailure('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
  if (env.SUPABASE_SERVICE_ROLE_KEY !== config.serviceRoleKey) throw preflightFailure('SUPABASE_SERVICE_ROLE_KEY must match E2E_SUPABASE_SERVICE_ROLE_KEY')
  const port = config.baseURL.url.port || (config.baseURL.url.protocol === 'https:' ? '443' : '80')
  return spawn(process.execPath, [nextBin, 'dev', '--hostname', config.baseURL.host, '--port', port], { cwd, env, stdio: 'inherit' })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const child = createE2ELauncher()
    child.once('exit', code => { process.exitCode = code ?? 1 })
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
