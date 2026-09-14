import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { execFileSync } from 'child_process'
import { pathToFileURL } from 'url'

const root = process.cwd()
const ignoredDirs = new Set(['.git', '.next', '.npm-cache', 'node_modules'])
const ignoredFiles = new Set(['.env.local'])
const secretNames = String.raw`(SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|WEBHOOK)[A-Z0-9_]*)`
const secretTokenPattern = new RegExp(String.raw`\b${secretNames}\b`, 'g')

const harmlessValue = value => {
  const normalized = value.replace(/^['"`]|['"`]$/g, '')
  return normalized === '' || /^<[^>]+>$/.test(normalized) || /^your-[a-z0-9-]+$/i.test(normalized)
}

const labelFor = name => {
  name = name.toUpperCase()
  if (name === 'SUPABASE_SERVICE_ROLE_KEY') return 'Supabase service role key'
  if (name === 'STRIPE_SECRET_KEY') return 'Stripe secret key'
  if (name === 'STRIPE_WEBHOOK_SECRET') return 'Stripe webhook secret'
  return 'Secret env exposed publicly'
}

const lineAt = (text, index) => text.slice(0, index).split(/\r?\n/).length

function skipTrivia(text, index, { allowNewlines = false, language = 'javascript' } = {}) {
  let cursor = index
  while (cursor < text.length) {
    while (/\s/.test(text[cursor] || '')) {
      if (!allowNewlines && /\r|\n/.test(text[cursor])) return cursor
      cursor += 1
    }
    if (language === 'javascript' && text.startsWith('//', cursor)) {
      cursor = text.indexOf('\n', cursor + 2)
      if (cursor === -1 || !allowNewlines) return cursor === -1 ? text.length : cursor
      continue
    }
    if (language === 'javascript' && text.startsWith('/*', cursor)) {
      const end = text.indexOf('*/', cursor + 2)
      if (end === -1) return text.length
      cursor = end + 2
      continue
    }
    if ((language === 'shell' || language === 'powershell') && text[cursor] === '#') {
      cursor = text.indexOf('\n', cursor + 1)
      if (cursor === -1 || !allowNewlines) return cursor === -1 ? text.length : cursor
      continue
    }
    if (language === 'powershell' && text.startsWith('<#', cursor)) {
      const end = text.indexOf('#>', cursor + 2)
      if (end === -1) return text.length
      cursor = end + 2
      continue
    }
    break
  }
  return cursor
}

function lexCode(text, language) {
  const mask = text.split('')
  const quotedKeys = []
  const hide = index => { if (mask[index] !== '\n' && mask[index] !== '\r') mask[index] = ' ' }
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' || char === "'" || (language === 'javascript' && char === '`')) {
      const quote = char
      const start = index
      index += 1
      for (; index < text.length; index += 1) {
        if (text[index] === '\\') { hide(index); hide(index + 1); index += 1; continue }
        if (text[index] === quote) break
        hide(index)
      }
      hide(start); hide(index)
      if (index < text.length && quote !== '`') {
        const name = text.slice(start + 1, index)
        const after = skipTrivia(text, index + 1, { allowNewlines: true, language })
        if (text[after] === ':' && new RegExp(String.raw`^${secretNames}$`, language === 'powershell' ? 'i' : '').test(name)) {
          quotedKeys.push({ name, index: start + 1, valueIndex: after + 1 })
        }
      }
      continue
    }
    if (language === 'javascript' && char === '/' && next === '/') {
      while (index < text.length && text[index] !== '\n') { hide(index); index += 1 }
      continue
    }
    if (language === 'javascript' && char === '/' && next === '*') {
      hide(index); hide(index + 1); index += 2
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) { hide(index); index += 1 }
      hide(index); hide(index + 1); index += 1
      continue
    }
    if (language === 'powershell' && char === '<' && next === '#') {
      hide(index); hide(index + 1); index += 2
      while (index < text.length && !(text[index] === '#' && text[index + 1] === '>')) { hide(index); index += 1 }
      hide(index); hide(index + 1); index += 1
      continue
    }
    if ((language === 'shell' || language === 'powershell') && char === '#' && (index === 0 || /\s/.test(text[index - 1]))) {
      while (index < text.length && text[index] !== '\n') { hide(index); index += 1 }
    }
  }
  return { mask: mask.join(''), quotedKeys }
}

function readLiteral(text, index, allowBare, { dynamicVariables = false, dynamicCommands = false } = {}) {
  const quote = text[index]
  if (quote === '"' || quote === "'" || quote === '`') {
    let cursor = index + 1
    for (; cursor < text.length && cursor - index <= 4096; cursor += 1) {
      if (text[cursor] === '\\') { cursor += 1; continue }
      if (quote !== '`' && /\r|\n/.test(text[cursor])) return null
      if (quote === '`' && text[cursor] === '$' && text[cursor + 1] === '{') return null
      if (text[cursor] === quote) {
        const value = text.slice(index, cursor + 1)
        if (dynamicVariables && /\$(?:\{|[A-Za-z_])/.test(value)) return null
        return { value, end: cursor + 1 }
      }
    }
    return null
  }
  if (quote === '<') {
    const end = text.indexOf('>', index + 1)
    return end === -1 || end - index > 4096 ? null : { value: text.slice(index, end + 1), end: end + 1 }
  }
  if (!allowBare) return null
  const end = text.slice(index).search(/[\s,;#&|]/)
  const value = end === -1 ? text.slice(index) : text.slice(index, index + end)
  if (!value || /[${}()[\]?+]/.test(value) || /^(?:process|import|require)\b/.test(value)) return null
  if (dynamicCommands && /^(?:get|set|read|invoke|new|remove|write|start|stop|test|import|export)-[a-z]/i.test(value)) return null
  return { value, end: index + value.length }
}

function hasDynamicJavaScriptTail(text, index) {
  let cursor = index
  let sawNewline = false
  while (cursor < text.length) {
    while (/\s/.test(text[cursor] || '')) {
      if (/\r|\n/.test(text[cursor])) sawNewline = true
      cursor += 1
    }
    if (text.startsWith('//', cursor)) {
      const end = text.indexOf('\n', cursor + 2)
      if (end === -1) return false
      sawNewline = true
      cursor = end + 1
      continue
    }
    if (text.startsWith('/*', cursor)) {
      const end = text.indexOf('*/', cursor + 2)
      if (end === -1) return true
      if (/\r|\n/.test(text.slice(cursor, end + 2))) sawNewline = true
      cursor = end + 2
      continue
    }
    break
  }
  if (cursor >= text.length || ';,}'.includes(text[cursor])) return false
  if (sawNewline && !'+-*/?.:('.includes(text[cursor])) return false
  return true
}

function statementStart(mask, index) {
  return Math.max(mask.lastIndexOf(';', index - 1), mask.lastIndexOf('{', index - 1), mask.lastIndexOf('}', index - 1)) + 1
}

function typeAnnotationEquals(mask, index) {
  for (let cursor = index + 1; cursor < mask.length && cursor - index <= 4096; cursor += 1) {
    if (mask[cursor] === '=') return cursor
    if (',;{}'.includes(mask[cursor])) return -1
  }
  return -1
}

function languageFor(file) {
  if (/\.(?:ps1|psm1)$/i.test(file)) return 'powershell'
  if (/\.(?:sh|bash|zsh)$/i.test(file)) return 'shell'
  if (/(?:^|[/\\])\.env(?:\.|$)/i.test(file)) return 'dotenv'
  if (/\.json$/i.test(file)) return 'json'
  if (/\.(?:js|jsx|mjs|ts|tsx)$/i.test(file)) return 'javascript'
  return 'document'
}

function finish(matches) {
  return matches
    .sort((left, right) => left.index - right.index)
    .filter((match, index, sorted) => index === 0 || match.index !== sorted[index - 1].index)
    .map(({ line, label }) => ({ line, label }))
}

function collectJavaScript(text, language) {
  const { mask, quotedKeys } = lexCode(text, 'javascript')
  const matches = []
  const addMatch = (name, value, index) => {
    if (harmlessValue(value)) return
    matches.push({ index, line: lineAt(text, index), label: labelFor(name) })
  }
  if (language !== 'json') for (const token of mask.matchAll(secretTokenPattern)) {
    const name = token[1]
    const nameIndex = token.index
    const before = mask.slice(statementStart(mask, nameIndex), nameIndex)
    const isDeclaration = /\b(?:const|let|var)\b/.test(before)
    const lineStart = Math.max(mask.lastIndexOf('\n', nameIndex - 1), mask.lastIndexOf(';', nameIndex - 1), mask.lastIndexOf('&', nameIndex - 1), mask.lastIndexOf('|', nameIndex - 1)) + 1
    const isShell = /\b(?:export|set)\b/i.test(mask.slice(lineStart, nameIndex))
    const isPowerShell = /\$env:\s*$/i.test(mask.slice(Math.max(0, nameIndex - 6), nameIndex))
    let operator = skipTrivia(text, nameIndex + name.length, { allowNewlines: true, language: 'javascript' })
    let kind = null
    if (mask[operator] === '=') {
      kind = isPowerShell ? 'shell' : (isDeclaration ? 'declaration' : 'assignment')
      operator = skipTrivia(text, operator + 1, { allowNewlines: true, language: 'javascript' })
    } else if (mask[operator] === ':' && isDeclaration) {
      const equals = typeAnnotationEquals(mask, operator)
      if (equals !== -1) {
        kind = 'declaration'
        operator = skipTrivia(text, equals + 1, { allowNewlines: true, language: 'javascript' })
      }
    } else if (mask[operator] === ':') {
      kind = 'object'
      operator = skipTrivia(text, operator + 1, { allowNewlines: true, language: 'javascript' })
    }
    if (!kind) continue
    const literal = readLiteral(text, operator, isShell || isPowerShell, { dynamicVariables: isShell || isPowerShell })
    if (literal && (isShell || isPowerShell || !hasDynamicJavaScriptTail(text, literal.end))) addMatch(name, literal.value, nameIndex)
  }
  for (const key of quotedKeys) {
    const valueIndex = skipTrivia(text, key.valueIndex, { allowNewlines: true, language: 'javascript' })
    const literal = readLiteral(text, valueIndex, false)
    if (literal && !hasDynamicJavaScriptTail(text, literal.end)) addMatch(key.name, literal.value, key.index)
  }
  return finish(matches)
}

function collectShellLike(text, language) {
  const { mask } = lexCode(text, language)
  const matches = []
  const addMatch = (name, value, index) => {
    if (!harmlessValue(value)) matches.push({ index, line: lineAt(text, index), label: labelFor(name) })
  }
  for (const token of mask.matchAll(secretTokenPattern)) {
    const name = token[1]
    const nameIndex = token.index
    let operator = skipTrivia(text, nameIndex + name.length, { allowNewlines: false, language: 'shell' })
    if (mask[operator] !== '=') continue
    operator = skipTrivia(text, operator + 1, { allowNewlines: false, language: 'shell' })
    const literal = readLiteral(text, operator, true, { dynamicVariables: true })
    if (literal) addMatch(name, literal.value, nameIndex)
  }
  return finish(matches)
}

function collectPowerShell(text) {
  const { mask } = lexCode(text, 'powershell')
  const matches = []
  const pattern = new RegExp(String.raw`\$env:\s*${secretNames}\s*=`, 'gi')
  for (const match of mask.matchAll(pattern)) {
    const name = match[1]
    const equals = match.index + match[0].lastIndexOf('=')
    const valueIndex = skipTrivia(text, equals + 1, { allowNewlines: true, language: 'powershell' })
    const literal = readLiteral(text, valueIndex, true, { dynamicVariables: true, dynamicCommands: true })
    if (literal && !harmlessValue(literal.value)) matches.push({ index: match.index + match[0].toUpperCase().indexOf(name.toUpperCase()), line: lineAt(text, match.index), label: labelFor(name) })
  }
  return finish(matches)
}

function collectDotenv(text) {
  const { mask } = lexCode(text, 'shell')
  const matches = []
  for (const token of mask.matchAll(secretTokenPattern)) {
    const name = token[1]
    const nameIndex = token.index
    const lineStart = mask.lastIndexOf('\n', nameIndex - 1) + 1
    if (!/^[\t ]*(?:export[\t ]+)?$/i.test(mask.slice(lineStart, nameIndex))) continue
    let operator = skipTrivia(text, nameIndex + name.length, { allowNewlines: false, language: 'shell' })
    if (mask[operator] !== '=') continue
    operator = skipTrivia(text, operator + 1, { allowNewlines: false, language: 'shell' })
    const literal = readLiteral(text, operator, true, { dynamicVariables: true })
    if (literal && !harmlessValue(literal.value)) matches.push({ index: nameIndex, line: lineAt(text, nameIndex), label: labelFor(name) })
  }
  return finish(matches)
}

export function scanText(file, text) {
  const language = languageFor(file)
  if (language === 'powershell') return collectPowerShell(text)
  if (language === 'shell') return collectShellLike(text, language)
  if (language === 'dotenv' || language === 'document') return collectDotenv(text)
  return collectJavaScript(text, language)
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
    } else if (/\.(js|jsx|mjs|ts|tsx|json|md|sql|yml|yaml|env|toml|sh|bash|zsh|ps1|psm1)$/i.test(entry) || /^\.env(?:\.|$)/i.test(entry)) {
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
