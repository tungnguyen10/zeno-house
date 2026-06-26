#!/usr/bin/env node
// Spike #2: đo /api/dashboard/summary qua dev server + verify PostgREST limits.
// Cách chạy:
//   node scripts/dashboard-spike-http.mjs
// Có cookie thật:
//   ZENO_AUTH_COOKIE="sb-...=...; sb-refresh-token=..." node scripts/dashboard-spike-http.mjs

import { readFileSync } from 'node:fs'

const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envText.split('\n').filter(l => l && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]
  }),
)

const baseUrl = process.env.ZENO_APP_URL ?? 'https://localhost:3100'
const cookie = process.env.ZENO_AUTH_COOKIE ?? ''

// Allow self-signed dev cert (Nuxt dev HTTPS).
if (baseUrl.startsWith('https://')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}
const supabaseUrl = env.SUPABASE_URL
const supabaseAnon = env.SUPABASE_KEY
const supabaseService = env.SUPABASE_SECRET_KEY

function fmt(ms) { return `${ms.toFixed(1).padStart(7)} ms` }

async function timed(label, fn) {
  const start = performance.now()
  try {
    const value = await fn()
    return { label, ms: performance.now() - start, value, error: null }
  } catch (error) {
    return { label, ms: performance.now() - start, value: null, error }
  }
}

console.warn(`\n# Dashboard HTTP spike — ${new Date().toISOString()}`)
console.warn(`Base URL: ${baseUrl}`)
console.warn(`Auth cookie present: ${cookie ? 'yes' : 'NO (will see 401 — measures handler overhead only)'}\n`)

// ---------------- A. Handler latency ----------------
console.warn('## A. /api/dashboard/summary timing (5 cold + warm runs)')

const runs = []
for (let i = 0; i < 5; i++) {
  const r = await timed(`run #${i + 1}`, async () => {
    const res = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: cookie ? { cookie } : {},
    })
    const text = await res.text()
    return { status: res.status, contentLength: text.length, body: text.slice(0, 200) }
  })
  runs.push(r)
  if (r.error) {
    console.warn(`${r.label.padEnd(10)} ${fmt(r.ms)}   ERROR: ${r.error.message ?? r.error}`)
  }
  else {
    console.warn(`${r.label.padEnd(10)} ${fmt(r.ms)}   status=${r.value.status}   bytes=${r.value.contentLength}`)
  }
}

const successRuns = runs.filter(r => r.value?.status === 200)
const warmRuns = runs.slice(1)
const avg = arr => arr.reduce((a, b) => a + b.ms, 0) / Math.max(arr.length, 1)
console.warn(`\ncold (run 1)     ${fmt(runs[0].ms)}`)
console.warn(`warm avg (2-5)   ${fmt(avg(warmRuns))}`)
if (successRuns.length > 0) {
  console.warn(`200 payload size ${successRuns[0].value.contentLength} bytes`)
}
else {
  console.warn(`First non-200 body: ${runs[0].value?.body}`)
}

// ---------------- B. Compare with raw Supabase parallel total ----------------
console.warn('\n## B. Reference: raw Supabase Promise.all (same 8 queries)')
const headers = { apikey: supabaseService, Authorization: `Bearer ${supabaseService}` }
const today = new Date().toISOString().slice(0, 10)
const expiringSoon = new Date()
expiringSoon.setDate(expiringSoon.getDate() + 30)
const expiringSoonDate = expiringSoon.toISOString().slice(0, 10)

const queries = [
  `${supabaseUrl}/rest/v1/buildings?select=*&head=true`,
  `${supabaseUrl}/rest/v1/rooms?select=id,status,building_id`,
  `${supabaseUrl}/rest/v1/tenants?select=*&head=true`,
  `${supabaseUrl}/rest/v1/contracts?select=*&head=true&status=eq.active`,
  `${supabaseUrl}/rest/v1/contracts?select=*&head=true&status=eq.active&end_date=gte.${today}&end_date=lte.${expiringSoonDate}`,
  `${supabaseUrl}/rest/v1/billing_periods?select=id,building_id,period_year,period_month,status`,
  `${supabaseUrl}/rest/v1/invoices?select=billing_period_id,billing_periods(building_id,period_year,period_month),total_amount,paid_amount,balance_amount,status,due_date`,
  `${supabaseUrl}/rest/v1/buildings?select=id,slug,name&order=name.asc`,
]
const parStart = performance.now()
await Promise.all(queries.map(u => fetch(u, { headers })))
const parMs = performance.now() - parStart
console.warn(`Promise.all 8 queries  ${fmt(parMs)}`)

// ---------------- C. PostgREST max-rows verification ----------------
console.warn('\n## C. PostgREST max-rows verification')

// 1) Hit a small set with Content-Range to confirm header format
const probe1 = await fetch(`${supabaseUrl}/rest/v1/invoices?select=id`, {
  headers: { ...headers, Prefer: 'count=exact' },
})
const range1 = probe1.headers.get('content-range')
const probe1Body = await probe1.json()
console.warn(`invoices content-range  ${range1}   returned=${probe1Body.length}`)

// 2) Try requesting a large range via Range header — see if response gets capped
const probe2 = await fetch(`${supabaseUrl}/rest/v1/invoices?select=id`, {
  headers: { ...headers, Range: '0-9999', Prefer: 'count=exact' },
})
const range2 = probe2.headers.get('content-range')
const probe2Body = await probe2.json()
console.warn(`Range 0-9999            ${range2}   returned=${probe2Body.length}`)

// 3) Look up OpenAPI spec — Supabase exposes it at /rest/v1/
const openapi = await timed('OpenAPI', () => fetch(`${supabaseUrl}/rest/v1/`, { headers: { apikey: supabaseAnon } }).then(r => r.json()))
const info = openapi.value?.info ?? {}
console.warn(`OpenAPI fetched in ${fmt(openapi.ms)}`)
console.warn(`  title:   ${info.title}`)
console.warn(`  version: ${info.version}`)
console.warn(`  desc:    ${(info.description ?? '').slice(0, 200)}`)

// 4) Manual check hint
console.warn('\nManual verification (cannot probe without seeding > 1000 rows):')
console.warn('  Supabase Dashboard → Settings → API → Max Rows (default 1000)')
console.warn('  Or run in SQL editor: SHOW pgrst.db_max_rows;')

console.warn('\nDone.')
