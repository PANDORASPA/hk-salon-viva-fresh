import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { execFileSync } from 'child_process'
import { pathToFileURL } from 'url'

const root = process.cwd()
const ignoredDirs = new Set(['.git', '.next', '.npm-cache', 'node_modules'])
const ignoredFiles = new Set(['.env.local'])
const secretNames = String.raw`(SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|WEBHOOK)[A-Z0-9_]*)`
const quotedValue = String.raw`(?:"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|\x60(?:\\.|[^\x60\\\r\n])*\x60)`
const literalValue = String.raw`(${quotedValue}|[^\s;,#]+)`
const whitespaceBeforeLiteral = String.raw`[ \t]*(?:\r?\n[ \t]*(?=["'\x60]))?`
const assignmentPatterns = [
  new RegExp(String.raw`(?:^|[;\n])\s*(?:export\s+|set\s+)?${secretNames}\s*=${whitespaceBeforeLiteral}${literalValue}`, 'g'),
  new RegExp(String.raw`(?:^|[;\n])\s*(?:export\s+)?(?:const|let|var)\s+${secretNames}\s*(?::\s*[^=\r\n]+)?\s*=${whitespaceBeforeLiteral}${literalValue}`, 'g'),
  new RegExp(String.raw`(?:^|[;\n])\s*\$env:${secretNames}\s*=${whitespaceBeforeLiteral}${literalValue}`, 'gi'),
  new RegExp(String.raw`(?:^|[,{;\n])\s*["']?${secretNames}["']?\s*:${whitespaceBeforeLiteral}${literalValue}`, 'g'),
]
const shellCommandPattern = /(?:^|[;\n])\s*(?:export|set)\s+([^\r\n;]+)/g
const shellTokenPattern = new RegExp(String.raw`${secretNames}\s*=${whitespaceBeforeLiteral}${literalValue}`, 'g')

const harmlessValue = value => {
  const normalized = value.replace(/^['"`]|['"`]$/g, '')
  return normalized === '' || /^<[^>]+>$/.test(normalized) || /^your-[a-z0-9-]+$/i.test(normalized)
}

const labelFor = name => {
  if (name === 'SUPABASE_SERVICE_ROLE_KEY') return 'Supabase service role key'
  if (name === 'STRIPE_SECRET_KEY') return 'Stripe secret key'
  if (name === 'STRIPE_WEBHOOK_SECRET') return 'Stripe webhook secret'
  return 'Secret env exposed publicly'
}

const lineAt = (text, index) => text.slice(0, index).split(/\r?\n/).length

export function scanText(_file, text) {
  const matches = []
  const addMatch = (name, value, index) => {
    const isPublic = name.startsWith('NEXT_PUBLIC_')
    if (isPublic || !harmlessValue(value)) {
      matches.push({ index, line: lineAt(text, index), label: labelFor(name) })
    }
  }
  for (const pattern of assignmentPatterns) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      const name = match[1]
      const value = match[2]
      const nameIndex = match.index + match[0].indexOf(name)
      addMatch(name, value, nameIndex)
    }
  }
  for (const command of text.matchAll(shellCommandPattern)) {
    const commandText = command[1]
    const commandOffset = command.index + command[0].indexOf(commandText)
    shellTokenPattern.lastIndex = 0
    for (const token of commandText.matchAll(shellTokenPattern)) {
      addMatch(token[1], token[2], commandOffset + token.index)
    }
  }
  return matches
    .sort((left, right) => left.index - right.index)
    .filter((match, index, sorted) => index === 0 || match.index !== sorted[index - 1].index)
    .map(({ line, label }) => ({ line, label }))
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
