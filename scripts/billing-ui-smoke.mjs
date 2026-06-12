#!/usr/bin/env node

const baseUrl = process.env.ZENO_APP_URL ?? 'http://localhost:3000'
const buildingId = process.env.BILLING_BUILDING_ID
const period = process.env.BILLING_PERIOD_TOKEN
const cookie = process.env.ZENO_AUTH_COOKIE

if (!buildingId || !period) {
  console.error('Missing BILLING_BUILDING_ID or BILLING_PERIOD_TOKEN.')
  console.error('Usage: BILLING_BUILDING_ID=<building-id> BILLING_PERIOD_TOKEN=YYYY-MM ZENO_AUTH_COOKIE="<cookie>" node scripts/billing-ui-smoke.mjs')
  process.exit(1)
}

const headers = cookie ? { cookie } : {}
const workspaceUrl = `${baseUrl}/billing/${buildingId}/${period}`
const showcaseUrl = `${baseUrl}/ui-showcase`

async function assertReachable(url) {
  const response = await fetch(url, { headers, redirect: 'manual' })
  if (response.status >= 500) {
    throw new Error(`${url} returned ${response.status}`)
  }
  return response.status
}

const workspaceStatus = await assertReachable(workspaceUrl)
const showcaseStatus = await assertReachable(showcaseUrl)

console.warn(`OK: workspace route reachable (${workspaceStatus}) ${workspaceUrl}`)
console.warn(`OK: ui-showcase route reachable (${showcaseStatus}) ${showcaseUrl}`)
console.warn('Manual discrepancy smoke: create or use a seeded override where draft total differs from an issued invoice by at least 1000 VND, expand that draft row, click "Tao dieu chinh", confirm the payments tab opens with amount = -delta and reference set, submit, then confirm the callout disappears after reload.')
console.warn('Manual UI smoke: open the workspace, confirm exactly three tabs, open Nhật ký drawer, and open the close-period overflow action.')
