import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../..')
const migrations = resolve(root, 'supabase/migrations')
const filename = readdirSync(migrations).find(name => name.endsWith('_harden_ai_billing_assistant_flow.sql'))
const migrationPath = filename ? resolve(migrations, filename) : ''
const verificationPath = resolve(root, 'supabase/verification/ai_billing_assistant_flow.sql')

describe('AI flow hardening migration', () => {
  it('adds atomic chat turn, distributed quota/circuit, and leased claims', () => {
    expect(filename).toBeTruthy()
    expect(existsSync(migrationPath)).toBe(true)
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('function public.begin_ai_chat_turn')
    expect(sql).toContain('create table if not exists public.ai_provider_circuits')
    expect(sql).toContain('create table if not exists public.ai_global_daily_quotas')
    expect(sql).toContain('function public.acquire_ai_provider_request')
    expect(sql).toContain('function public.record_ai_provider_outcome')
    expect(sql).toContain('p_lease_seconds integer')
    expect(sql).toContain("status = 'executing'")
  })

  it('keeps all new state and functions service-role only', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toMatch(/alter table public\.ai_provider_circuits enable row level security/i)
    expect(sql).toMatch(/alter table public\.ai_global_daily_quotas enable row level security/i)
    expect(sql).toMatch(/revoke all on table public\.ai_provider_circuits from public, anon, authenticated/i)
    expect(sql).toMatch(/revoke all on table public\.ai_global_daily_quotas from public, anon, authenticated/i)
    expect(sql).toMatch(/revoke all on function public\.begin_ai_chat_turn[\s\S]+from public, anon, authenticated/i)
    expect(sql).toMatch(/grant execute on function public\.begin_ai_chat_turn[\s\S]+to service_role/i)
    expect(sql).not.toMatch(/security definer/i)
  })

  it('ships read-only verification for RLS, grants, RPC security, and recovery state', () => {
    const sql = readFileSync(verificationPath, 'utf8')
    expect(sql).toContain('execution_lease_until')
    expect(sql).toContain('has_function_privilege')
    expect(sql).toContain('row_security_active')
    expect(sql).toContain('prosecdef')
    expect(sql).toContain('expect zero')
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate)\s+(into|public\.)/i)
  })
})
