import { runE2ERuntimePreflight } from '../lib/e2e/runtime-preflight.mjs'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
const run = promisify(execFile)
const script = fileURLToPath(new URL('../scripts/seed-e2e.mjs', import.meta.url))
export function createGlobalSetup({
  preflight = runE2ERuntimePreflight,
  seed = () => run(process.execPath, [script, 'seed'], { env: process.env }),
  cleanup = () => run(process.execPath, [script, 'cleanup'], { env: process.env }),
  env = process.env,
} = {}) {
  return async function globalSetup() {
    await preflight()
    // Teardown is now authorized before any fixture mutation starts.
    env.E2E_RUNTIME_PREFLIGHT_PASSED = '1'
    try { await seed() } catch (seedError) {
      try { await cleanup() } catch (cleanupError) { throw new AggregateError([seedError, cleanupError], 'E2E seed and cleanup both failed') }
      throw seedError
    }
  }
}
export default createGlobalSetup()
