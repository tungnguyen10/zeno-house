import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261111130000_contract_documents.sql'), 'utf8')

describe('contract_documents migration', () => {
  it('creates a private bucket with the DOCX mime', () => {
    expect(sql).toContain(`insert into storage.buckets`)
    expect(sql).toContain(`'contract-documents'`)
    expect(sql).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(sql).toMatch(/values\s*\('contract-documents'[\s\S]*?false/)
  })

  it('creates the table locked to service_role with FK restrict', () => {
    expect(sql).toContain('create table if not exists public.contract_documents')
    expect(sql).toContain('references public.contracts(id) on delete restrict')
    expect(sql).toContain('alter table public.contract_documents enable row level security;')
    expect(sql).toContain('revoke all on table public.contract_documents from public, anon, authenticated;')
    expect(sql).not.toMatch(/create policy/i)
  })

  it('has the active-uniqueness index and the guard triggers', () => {
    expect(sql).toContain('contract_documents_one_active')
    expect(sql).toContain('create trigger contract_documents_guard')
    expect(sql).toContain('create trigger contract_inventory_items_lock')
    expect(sql).toContain('CONTRACT_INVENTORY_LOCKED')
  })

  it('defines the RPCs granted only to service_role', () => {
    for (const fn of ['reserve_contract_document', 'finalize_contract_document', 'fail_contract_document',
      'mark_contract_document_signed', 'void_contract_document', 'claim_stale_contract_documents']) {
      expect(sql).toContain(`function public.${fn}`)
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`))
    }
  })

  it('schedules the cleanup cron', () => {
    expect(sql).toContain(`cron.schedule(\n  'contract-documents-cleanup'`)
  })
})
