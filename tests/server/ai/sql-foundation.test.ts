import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260714040637_ai_agent_foundation.sql'),
  'utf8',
).toLowerCase()

describe('AI agent foundation migration', () => {
  it.each(['ai_conversations', 'ai_messages', 'ai_action_plans'])('creates and protects %s', (table) => {
    expect(migration).toContain(`create table if not exists public.${table}`)
    expect(migration).toContain(`alter table public.${table} enable row level security`)
    expect(migration).toContain(`revoke all on table public.${table} from anon, authenticated`)
    expect(migration).toContain(`grant all on table public.${table} to service_role`)
  })

  it('uses server-generated unique idempotency keys', () => {
    expect(migration).toContain('idempotency_key uuid not null default gen_random_uuid()')
    expect(migration).toContain('constraint ai_action_plans_idempotency_key_unique unique (idempotency_key)')
  })

  it.each([
    'claim_ai_action_plan',
    'cancel_ai_action_plan',
    'complete_ai_action_plan',
    'fail_ai_action_plan',
    'mark_ai_action_plan_stale',
  ])('defines a compare-and-set lifecycle function for %s', (name) => {
    expect(migration).toContain(`function public.${name}`)
    expect(migration).toMatch(new RegExp(`revoke all on function public\\.${name}\\([^;]+ from public, anon, authenticated`))
    expect(migration).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^;]+ to service_role`))
  })

  it('keeps lifecycle functions invoker-safe and bounds retention cleanup', () => {
    expect(migration).not.toContain('security definer')
    expect(migration).toContain("expires_at timestamptz not null default (now() + interval '30 days')")
    expect(migration).toContain('function public.cleanup_expired_ai_conversations')
    expect(migration).toContain('if p_limit < 1 or p_limit > 5000 then')
    expect(migration).toContain('limit p_limit')
    expect(migration).toContain('for update skip locked')
  })
})
