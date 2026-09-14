import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { execFileSync } from 'child_process'
import { pathToFileURL } from 'url'

const root = process.cwd()
const ignoredDirs = new Set(['.git', '.next', '.npm-cache', 'node_modules'])
const ignoredFiles = new Set(['.env.local'])
const forbidden = [
  { label: 'Supabase service role key', pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\s#]+)/ },
  { label: 'Stripe secret key', pattern: /STRIPE_SECRET_KEY\s*=\s*([^\s#]+)/ },
  { label: 'Stripe webhook secret', pattern: /STRIPE_WEBHOOK_SECRET\s*=\s*([^\s#]+)/ },
  { label: 'Secret env exposed publicly', pattern: /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE|WEBHOOK)[A-Z0-9_]*\s*=\s*([^\s#]+)/, public: true },
]

const harmlessValue = value => {
  const normalized = value.replace(/^['"]|['"]$/g, '')
  return normalized === '' || /^<[^>]+>$/.test(normalized) || /^your-[a-z0-9-]+$/i.test(normalized)
}

export function scanText(_file, text) {
  const findings = []
  text.split(/\r?\n/).forEach((line, index) => {
    for (const rule of forbidden) {
      const match = line.match(rule.pattern)
      if (match && (rule.public || !harmlessValue(match[1]))) findings.push({ line: index + 1, label: rule.label })
    }
  })
  return findings
}

export function scanRepository(root = process.cwd()) {
  const findings = []

try {
  const tracked = execFileSync('git', ['ls-files'], { encoding:'utf8' }).split(/\r?\n/)
  for (const file of tracked) {
    if (/^\.env($|\.)/.test(file) && file !== '.env.example') findings.push({ file, line:1, label:'Tracked environment file' })
  }
} catch {
  // The content scan below remains useful outside a Git checkout.
}

  const scanFile = (path) => {
  const rel = relative(root, path).replaceAll('\\', '/')
  if (ignoredFiles.has(rel)) return
  const text = readFileSync(path, 'utf8')
    scanText(rel, text).forEach(finding => findings.push({ ...finding, file: rel }))
  }

  const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      walk(path)
    } else if (/\.(js|jsx|mjs|ts|tsx|json|md|sql|yml|yaml|env|toml)$/i.test(entry)) {
      scanFile(path)
    }
  }
  }

  walk(root)
  return findings
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const findings = scanRepository()
  if (findings.length > 0) {
    console.error('Security scan failed:')
    findings.forEach((finding) => {
      console.error(`- ${finding.label}: ${finding.file}:${finding.line}`)
    })
    process.exitCode = 1
  } else {
    console.log('Security scan passed.')
  }
}
