import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const apiRoot = join(root, 'server/api')

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(entry => entry.isDirectory()
    ? walk(join(dir, entry.name))
    : [join(dir, entry.name)]))
  return files.flat().filter(file => /\.(get|post|patch|delete|put)\.ts$/.test(file))
}

function routeFor(file) {
  const rel = relative(apiRoot, file).replace(/\\/g, '/')
  const method = rel.match(/\.([a-z]+)\.ts$/)[1].toUpperCase()
  const path = `/api/${rel.replace(/\.[a-z]+\.ts$/, '').replace(/\/index$/, '')}`
  return { method, path }
}

const files = (await walk(apiRoot)).sort()
const rows = []
const explicitlyPaginated = new Set([
  '/api/audit',
  '/api/buildings',
  '/api/contracts',
  '/api/invoices',
  '/api/rooms',
  '/api/tenants',
])
for (const file of files) {
  const source = await readFile(file, 'utf8')
  const { method, path } = routeFor(file)
  const finalSegment = path.split('/').at(-1)
  const isDynamicDetail = finalSegment?.startsWith('[')
  const isList = method === 'GET' && !isDynamicDetail
    && (/\/index\.get\.ts$/.test(file) || /\/(audit|invoices|payments|occupants|renewals|utility-usages)\.get\.ts$/.test(file))
  const hasPagination = method === 'GET'
    && (explicitlyPaginated.has(path) || /page|cursor|limit/.test(source))
  const pagination = hasPagination ? 'bounded' : isList ? 'domain-bounded' : 'n/a'
  const cache = path === '/api/dashboard/summary'
    ? '20s scoped'
    : path === '/api/operations-report'
      ? '15s open / versioned closed'
      : path.includes('/draft-grid') || path.includes('/meter-readings') || path.includes('/payments')
        ? 'no long cache'
        : method === 'GET' ? 'request/DTO policy' : 'invalidate affected domain'
  const budget = path === '/api/dashboard/summary' || path === '/api/operations-report' || path.includes('/draft-grid')
    ? 'p95 ≤ 800ms'
    : isList ? 'p95 ≤ 400ms' : 'p95 ≤ 250ms'
  rows.push(`| ${method} | \`${path}\` | ${pagination} | ${cache} | ${budget} |`)
}

const document = `# API Inventory And Performance Contracts

Generated from checked-in handlers by \`node scripts/generate-api-inventory.mjs\`.
Route count: **${rows.length}**.

All business routes require server-side authorization unless explicitly documented as an internal-secret route. Initial reads use Nuxt \`useFetch\`; imperative reads and mutations use \`apiFetch\` with a 15-second timeout, request ID, no automatic mutation retry, and normalized server envelopes.

| Method | Route | Pagination | Cache / invalidation | Budget |
| --- | --- | --- | --- | --- |
${rows.join('\n')}
`

await writeFile(join(root, 'docs/api-inventory.md'), document)
