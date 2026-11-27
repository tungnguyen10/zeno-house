import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20261127090000_tenant_portal_private_reads.sql', 'utf8')
const verification = readFileSync('supabase/verification/tenant_portal_private_reads.sql', 'utf8')

describe('portal direct read privacy migration contract', () => {
  it('closes whole-row and legacy column grants without disabling RLS or server reads', () => {
    expect(migration).toContain("array['contracts', 'contract_occupants', 'invoices']")
    expect(migration).toContain('revoke select on table public.%I from public, anon, authenticated')
    expect(migration).toContain('revoke select (%s) on public.%I from public, anon, authenticated')
    expect(migration).toContain('grant select on table public.%I to service_role')
    expect(migration).not.toMatch(/disable\s+row\s+level\s+security/i)
  })

  it('closes direct support writes whose RLS depended on the removed contract reads', () => {
    expect(migration).toContain('revoke insert, update, delete on public.support_requests from public, anon, authenticated')
    expect(migration).toContain('revoke insert (%s), update (%s)')
    expect(migration).toContain('grant select, insert, update, delete on public.support_requests to service_role')
  })

  it('provides non-mutating effective privilege checks including inherited/column grants', () => {
    expect(verification).toContain('has_table_privilege')
    expect(verification).toContain('has_column_privilege')
    expect(verification).toContain('relrowsecurity')
    expect(verification).toContain('rollback;')
    expect(verification).not.toMatch(/(?:insert\s+into|update\s+public\.|delete\s+from)/i)
  })
})
