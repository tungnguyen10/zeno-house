import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261116110000_tenant_ocr_usage.sql'), 'utf8')

describe('tenant OCR usage migration', () => {
  it('creates a service-role-only usage table without identity data', () => {
    expect(sql).toContain('create table if not exists public.tenant_ocr_usage')
    expect(sql).toContain('alter table public.tenant_ocr_usage enable row level security;')
    expect(sql).toContain('revoke all on table public.tenant_ocr_usage from public, anon, authenticated;')
    expect(sql).toMatch(/grant select, insert, update on table public\.tenant_ocr_usage to service_role;/)
    for (const forbidden of ['full_name', 'id_number', 'image', 'prompt', 'response']) {
      expect(sql).not.toContain(forbidden)
    }
  })

  it('serializes reservations per UTC day with an advisory lock', () => {
    expect(sql).toContain("pg_advisory_xact_lock(hashtextextended('tenant_ocr:'")
    expect(sql).toContain("at time zone 'utc'")
  })

  it('raises stable limit codes', () => {
    for (const code of ['TENANT_OCR_GLOBAL_LIMIT', 'TENANT_OCR_USER_LIMIT', 'TENANT_OCR_BUDGET']) {
      expect(sql).toContain(`'${code}'`)
    }
  })

  it('ignores released and stale reservations when counting', () => {
    expect(sql).toContain("status in ('reserved', 'settled')")
    expect(sql).toContain("interval '10 minutes'")
  })

  it.each([
    ['reserve_tenant_ocr', 'uuid, integer, integer, bigint, bigint'],
    ['settle_tenant_ocr', 'uuid, bigint, integer, integer, text'],
    ['release_tenant_ocr', 'uuid'],
  ])('restricts %s to service_role', (fn, args) => {
    expect(sql).toContain(`revoke all on function public.${fn}(${args}) from public, anon, authenticated;`)
    expect(sql).toContain(`grant execute on function public.${fn}(${args}) to service_role;`)
  })
})
