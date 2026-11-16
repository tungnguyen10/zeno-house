import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261111120000_contract_quick_create.sql'), 'utf8')

describe('contract quick create migration', () => {
  it('creates contract_vehicles locked to service_role', () => {
    expect(sql).toContain('create table if not exists public.contract_vehicles')
    expect(sql).toContain('alter table public.contract_vehicles enable row level security;')
    expect(sql).toContain('revoke all on table public.contract_vehicles from public, anon, authenticated;')
  })

  it('wraps the PR2 function without redefining existing RPCs', () => {
    expect(sql).toContain('public.create_contract_with_handover_and_inventory(')
    expect(sql).not.toMatch(/function public\.create_contract_with_handover(_and_inventory)?\(/)
  })

  it('uses namespaced idempotency key and service_role grant', () => {
    expect(sql).toContain(`'contract.create:' || p_request_id::text`)
    expect(sql).toContain('grant execute on function public.create_contract_full(jsonb, jsonb, jsonb, jsonb, jsonb, uuid, uuid) to service_role;')
  })
})
