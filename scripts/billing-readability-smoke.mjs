#!/usr/bin/env node

const baseUrl = process.env.ZENO_APP_URL ?? 'http://localhost:3000'
const periodId = process.env.BILLING_PERIOD_ID
const cookie = process.env.ZENO_AUTH_COOKIE

if (!periodId) {
  console.error('Missing BILLING_PERIOD_ID.')
  console.error('Usage: BILLING_PERIOD_ID=<id> ZENO_AUTH_COOKIE="<cookie>" node scripts/billing-readability-smoke.mjs')
  process.exit(1)
}

const headers = cookie ? { cookie } : {}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers })
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const overview = await getJson(`/api/billing/periods/${periodId}/overview`)
assert(Array.isArray(overview.data.auditEvents), 'overview.data.auditEvents must be an array')

const audit = await getJson(`/api/billing/periods/${periodId}/audit`)
assert(Array.isArray(audit.data), 'audit.data must be an array')

const draftGrid = await getJson(`/api/billing/periods/${periodId}/draft-grid`)
assert(Array.isArray(draftGrid.data.rows), 'draft-grid.data.rows must be an array')

for (const event of audit.data) {
  assert('actorName' in event, `audit event ${event.id} missing actorName`)
  assert('actorEmail' in event, `audit event ${event.id} missing actorEmail`)
  assert('entityLabel' in event, `audit event ${event.id} missing entityLabel`)
  assert('entitySubLabel' in event, `audit event ${event.id} missing entitySubLabel`)
  assert('entityHref' in event, `audit event ${event.id} missing entityHref`)
  assert(typeof event.summary === 'string' && event.summary.length > 0, `audit event ${event.id} missing summary`)
}

console.warn(`OK: overview returned ${overview.data.auditEvents.length} enriched audit events`)
console.warn(`OK: audit endpoint returned ${audit.data.length} enriched audit events`)

const rowsWithIssuedInvoice = draftGrid.data.rows.filter(row => row.existingInvoice)
for (const row of rowsWithIssuedInvoice) {
  assert(typeof row.existingInvoice.id === 'string', `draft row ${row.key} existingInvoice missing id`)
  assert(typeof row.existingInvoice.totalAmount === 'number', `draft row ${row.key} existingInvoice missing totalAmount`)
  assert(typeof row.existingInvoice.paidAmount === 'number', `draft row ${row.key} existingInvoice missing paidAmount`)
  assert(typeof row.existingInvoice.status === 'string', `draft row ${row.key} existingInvoice missing status`)
}

console.warn(`OK: draft-grid returned ${rowsWithIssuedInvoice.length} rows with existingInvoice context`)
console.warn('For N+1 verification, run the dev server with BILLING_DISPLAY_DEBUG=1 and inspect [billing-display-resolver] queryCounts.')
