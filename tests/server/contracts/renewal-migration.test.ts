import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve('supabase/migrations/20261105120000_atomic_contract_renewal.sql'), 'utf8')

describe('atomic contract renewal migration', () => {
  it('adds idempotency and one-successor constraints', () => {
    expect(migration).toMatch(/add column operation_id uuid unique/i)
    expect(migration).toMatch(/create unique index contracts_one_successor[\s\S]*where previous_contract_id is not null/i)
  })

  it('defines a service-role-only invoker RPC with every domain error code', () => {
    expect(migration).toMatch(/function public\.renew_contract_atomic/i)
    expect(migration).toMatch(/security invoker/i)
    expect(migration).toMatch(/set search_path = ''/i)
    expect(migration).toMatch(/revoke all on function public\.renew_contract_atomic[\s\S]*from public, anon, authenticated/i)
    expect(migration).toMatch(/grant execute on function public\.renew_contract_atomic[\s\S]*to service_role/i)
    for (const code of ['CONTRACT_NOT_FOUND', 'CONTRACT_NOT_ACTIVE', 'CONTRACT_CHECKOUT_IN_PROGRESS', 'CONTRACT_ALREADY_RENEWED', 'RENEWAL_OPERATION_MISMATCH', 'RENEWAL_OCCUPANTS_MISSING', 'RENEWAL_END_DATE_INVALID', 'CONTRACT_RENEWED_RECEIPT_LOCKED']) {
      expect(migration).toContain(code)
    }
  })

  it('pairs domain errors with their required SQLSTATE', () => {
    for (const [code, state] of Object.entries({
      CONTRACT_NOT_FOUND: 'P0002',
      CONTRACT_NOT_ACTIVE: '23514',
      CONTRACT_CHECKOUT_IN_PROGRESS: '23514',
      CONTRACT_ALREADY_RENEWED: '23505',
      RENEWAL_OPERATION_MISMATCH: '23505',
      RENEWAL_OCCUPANTS_MISSING: '23514',
      RENEWAL_END_DATE_INVALID: '22008',
      CONTRACT_RENEWED_RECEIPT_LOCKED: '23514',
    })) expect(migration).toContain(`raise exception '${code}' using errcode = '${state}'`)
  })

  it('uses the inclusive-end-date convention and moves deposit sources', () => {
    expect(migration).toMatch(/old_row\.end_date \+ 1/)
    expect(migration).toMatch(/move_out_date = old_row\.end_date/)
    expect(migration).toMatch(/update public\.contract_checkout_sources[\s\S]*contract_checkout_source_balance\(s\.id\) > 0/i)
  })

  it('locks receipts on renewed contracts before the checkout guard runs', () => {
    expect(migration).toMatch(/trigger a_contract_payments_renewed_lock[\s\S]*before insert or update or delete on public\.contract_payments/i)
    expect(migration).toMatch(/contract_checkout_payment_guard[\s\S]*h\.contract_id = source\.contract_id/i)
  })

  it('serializes the receipt lock against a concurrent renewal', () => {
    expect(migration).toMatch(/function public\.contract_payments_renewed_lock[\s\S]*for key share/i)
  })

  it('returns the previous result on replay and rejects a reused operation id with different input', () => {
    expect(migration).toMatch(/where operation_id = p_operation_id/i)
    expect(migration).toMatch(/'replayed', true/)
    expect(migration).toMatch(/'replayed', false/)
  })

  it('locks contract, room, open occupants and sources in a fixed order', () => {
    const contractLock = migration.indexOf('where id = p_contract_id for update')
    const roomLock = migration.indexOf('from public.rooms where id = old_row.room_id for update')
    const occupantLock = migration.search(/from public\.contract_occupants[\s\S]{0,120}move_out_date is null order by id for update/i)
    const sourceLock = migration.search(/from public\.contract_checkout_sources where contract_id = old_row\.id order by id for update/i)
    expect(contractLock).toBeGreaterThan(-1)
    expect(roomLock).toBeGreaterThan(contractLock)
    expect(occupantLock).toBeGreaterThan(roomLock)
    expect(sourceLock).toBeGreaterThan(occupantLock)
  })

  it('cancels scheduled amendments before the contract update so audit rows share the renewal correlation id', () => {
    const cancelLoops = [...migration.matchAll(/for am in select \* from public\.contract_amendments/gi)]
    expect(cancelLoops).toHaveLength(2)
    expect(migration).toMatch(/'contract\.amendment\.cancelled'[\s\S]*p_correlation_id/i)
  })

  it('leaves operation_id null on renewal audit rows because it is a unique partial index', () => {
    const rpc = migration.slice(migration.indexOf('function public.renew_contract_atomic'))
    const audits = rpc.match(/insert into public\.audit_events \([^)]*\)/gi) ?? []
    expect(audits.length).toBeGreaterThan(0)
    for (const audit of audits) expect(audit).not.toMatch(/operation_id/i)
  })

  it('accepts prior-chain receipts when crediting a successor and exposes their origin', () => {
    expect(migration).toMatch(/with recursive chain/i)
    expect(migration).toMatch(/chain\.depth < 20 and c\.status = 'renewed'/i)
    expect(migration).toContain("'originContractId'")
    expect(migration).toContain("'originContractCode'")
  })

  it('transfers sources with an audit only when something moved', () => {
    expect(migration).toMatch(/contract\.checkout_source\.transferred/)
    expect(migration).toMatch(/jsonb_array_length\(v_sources\) > 0/)
  })
})

describe('atomic renewal staging verification', () => {
  it('provides rollback-only fixtures and preflight checks without requiring the new function', () => {
    const verification = readFileSync(resolve('supabase/verification/atomic_contract_renewal.sql'), 'utf8')
    const integrity = readFileSync(resolve('supabase/verification/contract_renewal_integrity.sql'), 'utf8')
    expect(verification.trim()).toMatch(/rollback;$/i)
    for (const scenario of ['extend', 'roommates', 'depositHeld', 'RENEWAL_OPERATION_MISMATCH', 'CONTRACT_CHECKOUT_IN_PROGRESS', 'forced clone failure', 'CONTRACT_RENEWED_RECEIPT_LOCKED', 'contract_checkout_credit']) expect(verification).toContain(scenario)
    expect(integrity).toContain('contracts_with_multiple_successors')
    expect(integrity).toContain('to_regprocedure')
    expect(integrity).toContain('has_function_privilege')
  })
})

// Replacing checkout functions must preserve every existing guard and response field.
function checkoutBody(sql: string, name: string) {
  const start = sql.indexOf(`function public.${name}(`)
  const bodyStart = sql.indexOf('as $$', start) + 5
  const end = sql.indexOf('end $$;', bodyStart)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(bodyStart)
  return sql.slice(bodyStart, end)
}

describe('checkout function preservation', () => {
  const settlement = readFileSync(resolve('supabase/migrations/20261001143337_contract_checkout_settlement.sql'), 'utf8')
  const utilities = readFileSync(resolve('supabase/migrations/20261010140000_checkout_per_person_utilities.sql'), 'utf8')

  it('only changes allocated-receipt ownership in the receipt guard', () => {
    const previous = checkoutBody(settlement, 'contract_checkout_payment_guard')
      .replace('h.contract_id=old.contract_id', 'h.contract_id = source.contract_id')
    expect(checkoutBody(migration, 'contract_checkout_payment_guard')).toBe(previous)
  })

  it('preserves credit validation and audit around the ancestor receipt lookup', () => {
    const previous = checkoutBody(settlement, 'contract_checkout_credit')
      .replace(/select \* into p from public\.contract_payments[^;]+;/, 'RECEIPT_LOOKUP;')
    const current = checkoutBody(migration, 'contract_checkout_credit')
      .replace(/select \* into p from public\.contract_payments[\s\S]*?for update;/, 'RECEIPT_LOOKUP;')
    expect(current).toBe(previous)
  })

  it('preserves the checkout bundle except the expanded sources list', () => {
    const withoutSources = (sql: string) => checkoutBody(sql, 'contract_checkout_get')
      .replace(/'sources',[\s\S]*?(?= 'buildingPricing')/, 'SOURCES,\n')
    expect(withoutSources(migration)).toBe(withoutSources(utilities))
  })
})
