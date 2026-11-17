import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const original = readFileSync(resolve('supabase/migrations/20261105120000_atomic_contract_renewal.sql'), 'utf8')
const migration = readFileSync(resolve('supabase/migrations/20261117090000_renewal_copies_vehicles.sql'), 'utf8')

const body = (sql: string) => sql.slice(sql.indexOf('create or replace function public.renew_contract_atomic'), sql.indexOf('revoke all on function public.renew_contract_atomic'))

describe('renewal copies registered vehicles', () => {
  it('copies the old contract vehicles into the successor in new_contract mode', () => {
    expect(body(migration)).toMatch(/insert into public\.contract_vehicles \(contract_id, owner_name, plate_number, vehicle_type, note, sort_order\)\s+select new_row\.id, v\.owner_name, v\.plate_number, v\.vehicle_type, v\.note, v\.sort_order\s+from public\.contract_vehicles v\s+where v\.contract_id = old_row\.id/)
  })

  it('keeps the signature, grants and the rest of the original function', () => {
    const strip = (sql: string) => body(sql).replace(/\s+/g, ' ')
    const withoutVehicles = strip(migration).replace(/insert into public\.contract_vehicles.*?where v\.contract_id = old_row\.id; /, '')
    expect(withoutVehicles).toBe(strip(original))
    expect(migration).toContain('revoke all on function public.renew_contract_atomic(uuid, text, date, numeric, text, uuid, uuid, uuid) from public, anon, authenticated;')
    expect(migration).toContain('grant execute on function public.renew_contract_atomic(uuid, text, date, numeric, text, uuid, uuid, uuid) to service_role;')
  })

  it('does not touch extend mode, which keeps the same contract and vehicles', () => {
    const extendBranch = body(migration).split('-- new_contract')[0]
    expect(extendBranch).not.toContain('contract_vehicles')
  })
})
