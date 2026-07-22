import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260722085743_tenant_roommate_portal_access.sql',
), 'utf8')
const verificationSql = readFileSync(resolve(
  process.cwd(),
  'supabase/verification/tenant_identity_rls.sql',
), 'utf8')

function policy(name: string): string {
  const match = sql.match(new RegExp(`create policy ${name}[\\s\\S]*?;`, 'i'))
  expect(match, `missing policy ${name}`).not.toBeNull()
  return match![0]
}

describe('tenant roommate portal RLS migration', () => {
  it('grants authenticated tenants the minimum occupancy read privilege', () => {
    expect(sql).toMatch(/alter table public\.contract_occupants enable row level security/i)
    expect(sql).toMatch(/grant select on table public\.contract_occupants to authenticated/i)
    expect(policy('contract_occupants_tenant_select_own')).toContain('link.tenant_id = contract_occupants.tenant_id')
  })

  it('keeps primary contract history and adds only current roommate contract access', () => {
    const statement = policy('contracts_tenant_select_own')
    expect(statement).toContain('link.tenant_id = contracts.tenant_id')
    expect(statement).toContain('occupant.contract_id = contracts.id')
    expect(statement).toContain("occupant.move_in_date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date")
    expect(statement).toContain('occupant.move_out_date is null')
    expect(statement).toContain("contracts.status = 'active'")
    expect(statement).toContain("contracts.start_date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date")
    expect(statement).toContain("contracts.end_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date")
  })

  it('keeps primary invoice history and adds current shared-contract invoice access', () => {
    const statement = policy('invoices_tenant_select_own')
    expect(statement).toContain('link.tenant_id = invoices.tenant_id')
    expect(statement).toContain('occupant.contract_id = invoices.contract_id')
    expect(statement).toContain('occupant.move_out_date is null')
    expect(statement).toContain("shared_contract.status = 'active'")
    expect(statement).toContain("shared_contract.start_date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date")
    expect(statement).toContain("shared_contract.end_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date")
  })

  it('documents a complete rollback for the new table privilege', () => {
    expect(sql).toMatch(/Rollback:[\s\S]*revoke authenticated SELECT on contract_occupants/i)
  })

  it('requires tenant role, current auth subject and an active account link in every policy', () => {
    for (const name of [
      'contract_occupants_tenant_select_own',
      'contracts_tenant_select_own',
      'invoices_tenant_select_own',
    ]) {
      const statement = policy(name)
      expect(statement).toContain("(auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'")
      expect(statement).toContain('link.auth_user_id = (select auth.uid())')
      expect(statement).toContain("link.status = 'active'")
    }
  })
})

describe('tenant roommate RLS verification fixtures', () => {
  it('uses a room without an active contract and creates only one active fixture contract', () => {
    const contractFixtureInsert = verificationSql.match(/insert into public\.contracts[\s\S]*?;/i)?.[0] ?? ''

    expect(verificationSql).toMatch(/from public\.rooms as fixture_room[\s\S]*?where not exists \([\s\S]*?existing\.room_id = fixture_room\.id[\s\S]*?existing\.status = 'active'/i)
    expect(contractFixtureInsert.match(/^\s*'active'\s*$/gim)).toHaveLength(1)
    expect(contractFixtureInsert.match(/^\s*'terminated'\s*$/gim)).toHaveLength(1)
  })

  it('chooses an unused billing period for the fixture building', () => {
    expect(verificationSql).toContain('generate_series(2000, 2100)')
    expect(verificationSql).toContain('billing_period.building_id = fixture_room.building_id')
  })
})
