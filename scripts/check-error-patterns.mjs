#!/usr/bin/env node
// Guard against reintroducing patterns that this codebase has deliberately centralized:
//  - Repositories must use `throwDbError`/`throwInternal` instead of leaking raw DB errors via
//    `createError({ statusCode: 500, ... })`.
//  - Client code must extract API error fields through `~/utils/api-error` helpers instead of
//    ad-hoc `as { data?: { error?: ... } }` structural casts.
//
// Usage: node scripts/check-error-patterns.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const checks = [
  {
    label: 'Raw 500 createError in repositories (use throwDbError/throwInternal)',
    dir: 'server/repositories',
    exts: ['.ts'],
    pattern: /createError\(\s*\{\s*statusCode:\s*500\b/,
  },
  {
    label: 'Ad-hoc API error cast in client (use ~/utils/api-error helpers)',
    dir: 'app',
    exts: ['.ts', '.vue'],
    pattern: /as\s*\{\s*data\?:\s*\{\s*error\?/,
    exclude: [join('app', 'utils', 'api-error.ts')],
  },
]

function walk(dir, exts, files = []) {
  let entries
  try {
    entries = readdirSync(dir)
  }
  catch {
    return files
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) walk(full, exts, files)
    else if (exts.some(ext => full.endsWith(ext))) files.push(full)
  }
  return files
}

let violations = 0

for (const check of checks) {
  const files = walk(join(root, check.dir), check.exts)
  for (const file of files) {
    const rel = relative(root, file)
    if (check.exclude?.some(ex => rel === ex)) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (check.pattern.test(line)) {
        violations++
        console.error(`✗ ${check.label}\n  ${rel}:${index + 1}: ${line.trim()}`)
      }
    })
  }
}

if (violations > 0) {
  console.error(`\nFound ${violations} banned pattern occurrence(s).`)
  process.exit(1)
}

console.warn('✓ No banned error-handling patterns found.')
