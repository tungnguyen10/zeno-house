import { readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const TARGETS = [
  'app/layouts/default.vue',
  'app/pages/dashboard',
  'app/components/app',
  'app/components/ui',
  'app/components/billing',
  'app/components/buildings',
  'app/components/contracts',
  'app/components/dashboard',
  'app/components/invoices',
  'app/components/operations-report',
  'app/components/rooms',
  'app/components/tenants',
]

const PRINT_ALLOWLIST = new Set([
  'app/pages/dashboard/invoices/print.vue',
  'app/components/invoices/InvoicePrintCard.vue',
])

const TOKEN_ALLOWLIST = new Map([
  ['app/components/invoices/InvoicePaymentProfileCard.vue', new Set(['bg-white'])],
  ['app/components/buildings/BuildingInvoiceProfileSettings.vue', new Set(['bg-white'])],
])

const FORBIDDEN = /\b(?:bg-dark(?:-[\w-]+)?|text-white|text-muted|text-cyan(?:\/\d+)?|border-dark(?:-[\w-]+)?|divide-dark(?:-[\w-]+)?|ring-dark(?:-[\w-]+)?|placeholder-muted|success-neon|error-vivid|error-bg|shadow-black(?:\/\d+)?|bg-black(?:\/\d+)?|bg-white(?:\/\d+)?)\b/g

function vueFiles(path: string): string[] {
  const absolute = resolve(ROOT, path)
  if (!statSync(absolute).isDirectory()) return [absolute]
  return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const child = resolve(absolute, entry.name)
    if (entry.isDirectory()) return vueFiles(relative(ROOT, child))
    return entry.isFile() && entry.name.endsWith('.vue') ? [child] : []
  })
}

describe('dashboard semantic theme contract', () => {
  it('does not allow appearance-specific dark/light utilities in dashboard-bound UI', () => {
    const violations = TARGETS
      .flatMap(vueFiles)
      .map(file => ({ file, path: relative(ROOT, file) }))
      .filter(({ path }) => !PRINT_ALLOWLIST.has(path))
      .flatMap(({ file, path }) => {
        const source = readFileSync(file, 'utf8')
        const allowedTokens = TOKEN_ALLOWLIST.get(path)
        return Array.from(source.matchAll(FORBIDDEN), match => match[0])
          .filter(token => !allowedTokens?.has(token))
          .map(token => `${path}: ${token}`)
      })

    expect(violations).toEqual([])
  })
})
