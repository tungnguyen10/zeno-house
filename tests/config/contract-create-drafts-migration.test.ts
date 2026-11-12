import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261111121000_contract_create_drafts.sql'), 'utf8')

describe('contract_create_drafts migration', () => {
  it('creates a per-user table locked to service_role', () => {
    expect(sql).toContain('create table if not exists public.contract_create_drafts')
    expect(sql).toContain('user_id uuid primary key references auth.users(id) on delete cascade')
    expect(sql).toContain('alter table public.contract_create_drafts enable row level security;')
    expect(sql).toContain('revoke all on table public.contract_create_drafts from public, anon, authenticated;')
    expect(sql).not.toMatch(/create policy/i)
  })

  it('caps the payload at 64 KB', () => {
    expect(sql).toContain('octet_length(payload::text) <= 65536')
  })
})
