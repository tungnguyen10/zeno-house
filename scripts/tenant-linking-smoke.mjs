#!/usr/bin/env node
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

const CONFIRM_FLAG = '--confirm'

const errorCode = res => res?.json?.error?.code

/** Pure evaluation so the pass/fail rules are unit-tested; the HTTP calls live in main(). */
export function evaluateSmoke({ anonymousVerify, spoofCreate, spoofOccupant, unknownPhone, wrongProof }) {
  const identical = unknownPhone.status === wrongProof.status
    && JSON.stringify(unknownPhone.json) === JSON.stringify(wrongProof.json)
  return [
    {
      name: 'Anonymous link-verify is rejected (401)',
      ok: anonymousVerify.status === 401,
      detail: `status ${anonymousVerify.status}`,
    },
    {
      name: 'Spoofed create with an out-of-scope tenant_id is rejected (404 TENANT_NOT_LINKABLE)',
      ok: spoofCreate.status === 404 && errorCode(spoofCreate) === 'TENANT_NOT_LINKABLE',
      detail: `status ${spoofCreate.status} ${errorCode(spoofCreate) ?? ''}`.trim(),
    },
    {
      name: 'Spoofed occupant add with an out-of-scope tenant_id is rejected (404 TENANT_NOT_LINKABLE)',
      ok: spoofOccupant.status === 404 && errorCode(spoofOccupant) === 'TENANT_NOT_LINKABLE',
      detail: `status ${spoofOccupant.status} ${errorCode(spoofOccupant) ?? ''}`.trim(),
    },
    {
      name: 'Unknown phone and wrong proof are indistinguishable (identical 404 TENANT_LINK_UNVERIFIED)',
      ok: identical && unknownPhone.status === 404 && errorCode(unknownPhone) === 'TENANT_LINK_UNVERIFIED',
      detail: `unknown ${unknownPhone.status} ${errorCode(unknownPhone) ?? ''}, wrong ${wrongProof.status} ${errorCode(wrongProof) ?? ''}`.trim(),
    },
  ].concat([{
    // Keeps the count at five so a missing check is never silently skipped.
    name: 'Spoofed create did not create a contract',
    ok: !spoofCreate.json?.data?.id,
    detail: spoofCreate.json?.data?.id ? `CREATED ${spoofCreate.json.data.id}` : 'no contract returned',
  }])
}

async function call(baseUrl, path, { cookie, body }) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
  let json = null
  try { json = await res.json() }
  catch { /* non-JSON error page */ }
  return { status: res.status, json }
}

async function main() {
  const env = process.env
  const required = ['ZENO_AUTH_COOKIE', 'SMOKE_BUILDING_ID', 'SMOKE_ROOM_ID', 'SMOKE_CONTRACT_ID', 'SMOKE_FOREIGN_TENANT_ID']
  const missing = required.filter(name => !env[name])
  if (missing.length || !process.argv.includes(CONFIRM_FLAG)) {
    console.error(`Missing: ${missing.join(', ') || '(none)'}${process.argv.includes(CONFIRM_FLAG) ? '' : ` and the ${CONFIRM_FLAG} flag`}.`)
    console.error('Run as an owner/manager whose scope does NOT include SMOKE_FOREIGN_TENANT_ID (a tenant with an active tenancy elsewhere):')
    console.error('  ZENO_APP_URL=https://... ZENO_AUTH_COOKIE="<cookie>" SMOKE_BUILDING_ID=<uuid> SMOKE_ROOM_ID=<vacant room uuid> \\')
    console.error('  SMOKE_CONTRACT_ID=<active contract uuid in that building> SMOKE_FOREIGN_TENANT_ID=<uuid> node scripts/tenant-linking-smoke.mjs --confirm')
    console.error('Sends only requests a correct system rejects, but a vulnerable system would create data: do not run against production without approval.')
    process.exit(1)
  }

  const baseUrl = env.ZENO_APP_URL ?? 'http://localhost:3000'
  const cookie = env.ZENO_AUTH_COOKIE
  const verifyBody = proof => ({ building_id: env.SMOKE_BUILDING_ID, phone: '0999000999', proof })

  const results = evaluateSmoke({
    anonymousVerify: await call(baseUrl, '/api/tenants/link-verify', { body: verifyBody('x') }),
    spoofCreate: await call(baseUrl, '/api/contracts', {
      cookie,
      body: {
        request_id: randomUUID(),
        room_id: env.SMOKE_ROOM_ID,
        tenant_id: env.SMOKE_FOREIGN_TENANT_ID,
        start_date: '2030-01-01',
        end_date: '2031-01-01',
        monthly_rent: 1,
        handover_electricity_reading: 0,
        handover_water_reading: 0,
      },
    }),
    spoofOccupant: await call(baseUrl, `/api/contracts/${env.SMOKE_CONTRACT_ID}/occupants`, {
      cookie,
      body: { tenant_id: env.SMOKE_FOREIGN_TENANT_ID, role: 'roommate', move_in_date: '2030-01-01', billing_counted: true },
    }),
    unknownPhone: await call(baseUrl, '/api/tenants/link-verify', { cookie, body: verifyBody('999999999999') }),
    wrongProof: await call(baseUrl, '/api/tenants/link-verify', { cookie, body: { ...verifyBody('888888888888'), phone: '0999000998' } }),
  })

  for (const r of results) console.warn(`${r.ok ? 'PASS' : 'FAIL'}: ${r.name} (${r.detail})`)
  console.warn('Manual: with a second owner, verify a real former tenant, create the contract, then confirm owner A keeps only basic access and owner B has full access.')
  process.exit(results.every(r => r.ok) ? 0 : 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
