import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve('supabase/migrations/20260814095628_contract_amendments.sql'), 'utf8')

describe('contract amendments migration', () => {
  it('creates a server-owned amendment table with strict lifecycle constraints', () => {
    expect(migration).toMatch(/create table public\.contract_amendments/i)
    expect(migration).toMatch(/status in \('draft', 'scheduled', 'applied', 'cancelled'\)/i)
    expect(migration).toMatch(/unique \(contract_id, sequence_no\)/i)
    expect(migration).toMatch(/where status = 'scheduled'/i)
    expect(migration).toMatch(/jsonb_object_keys\(changes\)/i)
    expect(migration).toMatch(/alter table public\.contract_amendments enable row level security/i)
    expect(migration).toMatch(/revoke all on table public\.contract_amendments from public, anon, authenticated/i)
  })

  it('defines atomic publish, cancel, and due-application RPCs', () => {
    expect(migration).toMatch(/function public\.create_contract_amendment_draft/i)
    expect(migration).toMatch(/function public\.update_contract_amendment_draft/i)
    expect(migration).toMatch(/function public\.delete_contract_amendment_draft/i)
    expect(migration).toMatch(/function public\.publish_contract_amendment/i)
    expect(migration).toMatch(/function public\.cancel_contract_amendment/i)
    expect(migration).toMatch(/function public\.apply_due_contract_amendments/i)
    expect(migration).toMatch(/for update skip locked/i)
    expect(migration).toMatch(/security invoker/i)
    expect(migration).toMatch(/revoke all on function public\.apply_due_contract_amendments/i)
    expect(migration).toMatch(/grant execute on function public\.apply_due_contract_amendments[\s\S]*to service_role/i)
  })

  it('enforces lifecycle cleanup in the same contract transaction', () => {
    expect(migration).toMatch(/function public\.enforce_contract_amendment_lifecycle/i)
    expect(migration).toMatch(/before update or delete on public\.contracts/i)
    expect(migration).toContain('CONTRACT_HAS_PUBLISHED_AMENDMENTS')
  })

  it('isolates a failed due amendment from the rest of the worker batch', () => {
    expect(migration).toMatch(/exception when others then[\s\S]*raise warning/i)
  })

  it('records correlated amendment and contract audit rows', () => {
    expect(migration).toContain("'contract_amendment'")
    expect(migration).toContain("'contract.amendment.applied'")
    expect(migration).toContain("'contract.updated'")
    expect(migration).toMatch(/operation_id/i)
  })

  it('updates only current contract terms and never rewrites issued invoices', () => {
    expect(migration).toMatch(/update public\.contracts[\s\S]*monthly_rent[\s\S]*payment_due_day/i)
    expect(migration).not.toMatch(/update public\.invoices/i)
  })

  it('schedules a Vault-backed private worker without embedded credentials', () => {
    expect(migration).toContain("'contract-amendments-apply-due'")
    expect(migration).toContain("name = 'nitro_scheduler_base_url'")
    expect(migration).toContain("name = 'contract_amendments_apply_secret'")
    expect(migration).toContain("'/api/internal/contracts/amendments/apply-due'")
    expect(migration).not.toMatch(/https:\/\/[a-z0-9.-]+/i)
  })
})
