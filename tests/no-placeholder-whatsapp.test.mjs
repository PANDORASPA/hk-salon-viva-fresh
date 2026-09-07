import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Walk the repo and assert no runtime file still has the placeholder
// WhatsApp number `852XXXXXXXX` (or the `XXXX-XXXX` variant) that
// shipped in earlier commits.
//
// Allowed exceptions: docs/ and supabase/seed-* are excluded because
// they document the placeholder or are seed data not actually sent
// to customers at runtime.
const SCAN_EXT = new Set(['.js', '.jsx', '.sql', '.json', '.md', '.mjs'])
const SCAN_DIRS = ['app', 'lib', 'content', 'supabase/migrations']
const PLACEHOLDER_PATTERNS = [
  /852XXXXXXXX/,
  /\+852-XXXX-XXXX/,
]

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
      yield* walk(full)
    } else if (SCAN_EXT.has(path.extname(entry.name))) {
      yield full
    }
  }
}

test('no runtime file still ships the placeholder WhatsApp number', () => {
  const offenders = []
  for (const dir of SCAN_DIRS) {
    const abs = path.join(ROOT, dir)
    if (!fs.existsSync(abs)) continue
    for (const file of walk(abs)) {
      const text = fs.readFileSync(file, 'utf8')
      for (const re of PLACEHOLDER_PATTERNS) {
        if (re.test(text)) {
          offenders.push({ file: path.relative(ROOT, file), pattern: re.source })
        }
      }
    }
  }
  if (offenders.length) {
    assert.fail(
      `placeholder WhatsApp number still present in ${offenders.length} file(s):\n` +
        offenders.map((o) => `  ${o.file}  (${o.pattern})`).join('\n'),
    )
  }
})
