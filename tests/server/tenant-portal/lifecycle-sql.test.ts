import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260729120000_harden_tenant_account_lifecycle.sql',
), 'utf8')
const verification = readFileSync(resolve(
  process.cwd(),
  'supabase/verification/tenant_account_lifecycle.sql',
), 'utf8')

function policy(name: string): string {
  const match = sql.match(new RegExp(`create policy ${name}[\\s\\S]*?;`, 'i'))
  expect(match, `missing policy ${name}`).not.toBeNull()
  return match![0]
}

describe('tenant account lifecycle hardening migration', () => {
  it('changes curated historical Auth actor references to SET NULL without touching ownership cascades', () => {
    expect(sql).toContain(`'billing_audit_events', 'actor_id'`)
    expect(sql).toContain(`'audit_events', 'actor_id'`)
    expect(sql).toContain(`'invoice_payments', 'recorded_by'`)
    expect(sql).toMatch(/foreign key \(%I\) references auth\.users\(id\) on delete set null/i)
    expect(sql).not.toContain(`'tenant_user_links', 'auth_user_id'`)
    expect(sql).not.toContain(`'access_requests', 'auth_user_id'`)
  })

  it('scopes manager reads through explicit building assignments', () => {
    for (const name of [
      'tenants_manager_select',
      'contracts_manager_select',
      'contract_occupants_manager_select',
      'invoices_manager_select',
    ]) {
      const statement = policy(name)
      expect(statement).toContain('public.user_building_assignments')
      expect(statement).toContain('assignment.user_id = (select auth.uid())')
    }
  })

  it('derives invoice building scope through its billing period', () => {
    const statement = policy('invoices_manager_select')
    expect(statement).toContain('from public.billing_periods period')
    expect(statement).toContain('period.id = invoices.billing_period_id')
    expect(statement).toContain('assignment.building_id = period.building_id')
    expect(statement).not.toContain('invoices.building_id')
  })

  it('removes direct manager writes and browser write grants from sensitive tables', () => {
    expect(sql).toMatch(/drop policy if exists invoices_manager_insert on public\.invoices/i)
    expect(sql).toMatch(/drop policy if exists invoices_manager_update on public\.invoices/i)
    for (const table of ['tenants', 'contracts', 'contract_occupants', 'invoices']) {
      expect(sql).toContain(`revoke insert, update, delete on table public.${table} from authenticated`)
      expect(sql).toContain(`grant select on table public.${table} to authenticated`)
    }
  })

  it('allows only a current primary tenant or roommate to create a bounded support request', () => {
    const statement = policy('support_requests_tenant_insert_own')
    expect(statement).toContain('public.contract_occupants')
    expect(statement).toContain('occupant.tenant_id = link.tenant_id')
    expect(statement).toContain('char_length(btrim(title)) between 1 and 200')
    expect(statement).toContain('char_length(btrim(description)) between 1 and 5000')
  })

  it('ships read-only catalog and orphan verification queries', () => {
    expect(verification).toMatch(/information_schema\.referential_constraints/i)
    expect(verification).toMatch(/information_schema\.role_table_grants/i)
    expect(verification).toMatch(/from pg_policies/i)
    expect(verification).toMatch(/from auth\.users/i)
    expect(verification).not.toMatch(/^\s*(delete|update|insert|alter|drop)\b/im)
  })
})
