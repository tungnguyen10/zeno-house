import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260805184000_add_billing_incidental_charges.sql',
)
const sql = readFileSync(migrationPath, 'utf8')

describe('billing incidental charges migration', () => {
  it('creates a constrained, indexed, RLS-protected source table', () => {
    expect(sql).toMatch(/create table public\.billing_incidental_charges/i)
    expect(sql).toMatch(/amount\s+numeric\(12,0\)[\s\S]*check\s*\(amount > 0 and amount = trunc\(amount\)\)/i)
    expect(sql).toMatch(/check\s*\(length\(btrim\(label\)\) between 1 and 200\)/i)
    expect(sql).toMatch(/operation_id\s+uuid[\s\S]*unique/i)
    expect(sql).toMatch(/create index[\s\S]*billing_period_id, contract_id/i)
    expect(sql).toMatch(/alter table public\.billing_incidental_charges enable row level security/i)
    expect(sql).toMatch(/grant select on public\.billing_incidental_charges to service_role/i)
    expect(sql).toMatch(/revoke all on public\.billing_incidental_charges from anon, authenticated/i)
  })

  it('extends charge and audit entity constraints without dropping existing values', () => {
    for (const chargeType of ['rent', 'electricity', 'water', 'service', 'discount', 'surcharge', 'incidental', 'adjustment']) {
      expect(sql).toContain(`'${chargeType}'`)
    }
    expect(sql).toContain("'billing_incidental_charge'")
  })

  it('defines atomic create, update, and delete RPCs with financial locks', () => {
    for (const name of [
      'create_billing_incidental_charge_with_audit',
      'update_billing_incidental_charge_with_audit',
      'delete_billing_incidental_charge_with_audit',
    ]) {
      expect(sql).toMatch(new RegExp(`function public\\.${name}`,'i'))
    }
    expect(sql).toContain('for update')
    expect(sql).toContain('BILLING_PERIOD_LOCKED')
    expect(sql).toContain('BILLING_INVOICE_LOCKED')
    expect(sql).toContain('INCIDENTAL_CHARGE_VERSION_CONFLICT')
    expect(sql).toContain('INCIDENTAL_CHARGE_SCOPE_MISMATCH')
    expect(sql).toContain("'incidental_charge.created'")
    expect(sql).toContain("'incidental_charge.updated'")
    expect(sql).toContain("'incidental_charge.deleted'")
  })

  it('makes create idempotent and restricts definer RPC execution to service_role', () => {
    expect(sql).toMatch(/where operation_id = p_operation_id/i)
    expect(sql).toMatch(/security definer\s+set search_path = ''/i)
    expect(sql).toMatch(/revoke all on function public\.create_billing_incidental_charge_with_audit[\s\S]*from public, anon, authenticated/i)
    expect(sql).toMatch(/grant execute on function public\.create_billing_incidental_charge_with_audit[\s\S]*to service_role/i)
  })

  it('documents verification and rollback without editing generated types', () => {
    expect(sql).toContain('Verification')
    expect(sql).toContain('Rollback')
    expect(sql).toContain('supabase gen types typescript')
  })
})
