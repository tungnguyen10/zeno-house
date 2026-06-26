#!/usr/bin/env node
// Spike: đo dataset + latency từng query của DashboardRepository.
// Cách chạy: node scripts/dashboard-spike.mjs
// Yêu cầu .env có SUPABASE_URL + SUPABASE_SECRET_KEY (service role để bypass RLS khi đo).

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]
    }),
)

const url = env.SUPABASE_URL
const key = env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env')
  process.exit(1)
}

const client = createClient(url, key, { auth: { persistSession: false } })

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const today = now.toISOString().slice(0, 10)
const expiringSoon = new Date(now)
expiringSoon.setDate(expiringSoon.getDate() + 30)
const expiringSoonDate = expiringSoon.toISOString().slice(0, 10)

async function timed(label, fn) {
  const start = performance.now()
  const result = await fn()
  const ms = performance.now() - start
  return { label, ms, result }
}

function fmt(ms) {
  return `${ms.toFixed(1).padStart(7)} ms`
}

console.warn(`\n# Dashboard spike — ${now.toISOString()}`)
console.warn(`Current period: ${currentYear}-${String(currentMonth).padStart(2, '0')}\n`)

// ---------------- Row counts ----------------
console.warn('## Row counts')
const countTables = ['buildings', 'rooms', 'tenants', 'contracts', 'billing_periods', 'invoices', 'payments']
const counts = {}
for (const table of countTables) {
  const t = await timed(table, () =>
    client.from(table).select('*', { count: 'exact', head: true }),
  )
  counts[table] = t.result.count ?? 0
  const err = t.result.error?.message ?? ''
  console.warn(`${table.padEnd(18)} ${String(counts[table]).padStart(8)} rows   ${fmt(t.ms)}   ${err}`)
}

// ---------------- Per-query timing (mirrors DashboardRepository.Promise.all) ----------------
console.warn('\n## Per-query timing (mirror of DashboardRepository)')
const repoQueries = [
  ['buildings count', () => client.from('buildings').select('*', { count: 'exact', head: true })],
  ['rooms full select', () => client.from('rooms').select('id, status, building_id')],
  ['tenants count', () => client.from('tenants').select('*', { count: 'exact', head: true })],
  ['contracts active count', () => client.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'active')],
  ['contracts expiring count', () => client.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'active').gte('end_date', today).lte('end_date', expiringSoonDate)],
  ['billing_periods full select', () => client.from('billing_periods').select('id, building_id, period_year, period_month, status')],
  ['invoices joined select', () => client.from('invoices').select('billing_period_id, building_id:billing_periods(building_id, period_year, period_month), total_amount, paid_amount, balance_amount, status, due_date')],
  ['buildings details select', () => client.from('buildings').select('id, slug, name').order('name', { ascending: true })],
]

const sequentialTimings = []
for (const [label, fn] of repoQueries) {
  const t = await timed(label, fn)
  sequentialTimings.push(t)
  const rows = Array.isArray(t.result.data) ? t.result.data.length : (t.result.count ?? 0)
  console.warn(`${label.padEnd(32)} ${fmt(t.ms)}   rows=${String(rows).padStart(6)}   ${t.result.error?.message ?? ''}`)
}
const sequentialTotal = sequentialTimings.reduce((acc, t) => acc + t.ms, 0)
console.warn(`${'sequential total'.padEnd(32)} ${fmt(sequentialTotal)}`)

// ---------------- Parallel batch (như Promise.all hiện tại) ----------------
const parallelStart = performance.now()
const parallelResults = await Promise.all(repoQueries.map(([, fn]) => fn()))
const parallelMs = performance.now() - parallelStart
console.warn(`${'Promise.all (8 queries)'.padEnd(32)} ${fmt(parallelMs)}`)

// ---------------- JS aggregation cost ----------------
const allRooms = parallelResults[1].data ?? []
const invoices = parallelResults[6].data ?? []
const periods = parallelResults[5].data ?? []
const buildings = parallelResults[7].data ?? []

const aggStart = performance.now()
const roomsByBuilding = new Map()
for (const room of allRooms) {
  if (!roomsByBuilding.has(room.building_id)) roomsByBuilding.set(room.building_id, { total: 0, available: 0, occupied: 0, maintenance: 0 })
  const s = roomsByBuilding.get(room.building_id)
  s.total++
  if (room.status === 'available') s.available++
  else if (room.status === 'occupied') s.occupied++
  else if (room.status === 'maintenance') s.maintenance++
}
const periodById = new Map(periods.map(p => [p.id, p]))
let overdueScans = 0
for (const building of buildings) {
  invoices.forEach((invoice) => {
    overdueScans++
    const period = periodById.get(invoice.billing_period_id)
    void (period?.building_id === building.id
      && invoice.status !== 'void'
      && Number(invoice.balance_amount ?? 0) > 0
      && Boolean(invoice.due_date && invoice.due_date < today))
  })
}
const aggMs = performance.now() - aggStart
console.warn(`\n## JS aggregation`)
console.warn(`rooms aggregation     buildings=${buildings.length} rooms=${allRooms.length}`)
console.warn(`overdue inner scans   ${overdueScans} (= buildings × invoices)`)
console.warn(`total JS aggregation  ${fmt(aggMs)}`)

// ---------------- Payload size estimate ----------------
const fakePayload = {
  buildings: { total: counts.buildings },
  rooms: { total: counts.rooms, available: 0, occupied: 0, maintenance: 0 },
  tenants: { total: counts.tenants },
  contracts: { active: 0, expiringSoon: 0 },
  billing: { currentMonth: { period: '2026-06', invoiceTotal: 0, paidAmount: 0, outstandingAmount: 0, overdueAmount: 0 } },
  buildingBreakdown: buildings.map(b => ({ id: b.id, slug: b.slug, name: b.name, rooms: roomsByBuilding.get(b.id) ?? { total: 0, available: 0, occupied: 0, maintenance: 0 } })),
  billingTrend: [],
  pendingOperations: [],
}
const payloadBytes = Buffer.byteLength(JSON.stringify(fakePayload))
console.warn(`\n## Payload estimate`)
console.warn(`approx response size  ${payloadBytes} bytes (${(payloadBytes / 1024).toFixed(1)} KB)`)

console.warn('\nDone.')
