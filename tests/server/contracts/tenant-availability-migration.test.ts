import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { throwDbError } from '../../../server/utils/errors'
import { throwContractCreateError } from '../../../server/repositories/contracts'

const sql = readFileSync(resolve('supabase/migrations/20261118120000_tenant_availability_guard.sql'), 'utf8')

describe('tenant availability guard migration', () => {
  it('guards contracts and occupancies with invoker triggers and an empty search_path', () => {
    for (const fn of ['guard_contract_tenant_availability', 'guard_occupant_tenant_availability']) {
      const body = sql.slice(sql.indexOf(`function public.${fn}()`))
      expect(body).toMatch(/security invoker\s+set search_path = ''/)
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fn}\\(\\) from public, anon, authenticated`))
    }
    expect(sql).toMatch(/before insert or update of tenant_id, status on public\.contracts/)
    expect(sql).toMatch(/before insert or update of tenant_id, move_out_date on public\.contract_occupants/)
  })

  it('serializes per tenant before re-checking and raises TENANT_BUSY', () => {
    const lockIndex = sql.indexOf('pg_advisory_xact_lock(hashtextextended(\'tenant-availability:\'')
    expect(lockIndex).toBeGreaterThan(0)
    expect(sql.indexOf('raise exception \'TENANT_BUSY\'')).toBeGreaterThan(lockIndex)
    expect(sql.match(/raise exception 'TENANT_BUSY' using errcode = '23505'/g)).toHaveLength(2)
  })

  it('only checks rows that become live', () => {
    expect(sql).toMatch(/if new\.status <> 'active' then return new; end if;/)
    expect(sql).toMatch(/if new\.move_out_date is not null then return new; end if;/)
  })
})

describe('TENANT_BUSY error mapping', () => {
  it('maps the trigger error to a 409 conflict without database detail', () => {
    let error: { statusCode?: number; data?: { error?: { code?: string; details?: { reason?: string }; message?: string } } } = {}
    try { throwDbError({ code: '23505', message: 'TENANT_BUSY', details: 'secret detail' }, 'test') }
    catch (e) { error = e as typeof error }
    expect(error.statusCode).toBe(409)
    expect(error.data?.error?.details).toEqual({ reason: 'TENANT_BUSY' })
    expect(JSON.stringify(error)).not.toContain('secret detail')
  })

  it('maps the trigger error raised inside create_contract_full', () => {
    let error: { statusCode?: number; data?: { error?: { details?: { reason?: string } } } } = {}
    try { throwContractCreateError({ code: '23505', message: 'TENANT_BUSY' }) }
    catch (e) { error = e as typeof error }
    expect(error.statusCode).toBe(409)
    expect(error.data?.error?.details).toEqual({ reason: 'TENANT_BUSY' })
  })
})
