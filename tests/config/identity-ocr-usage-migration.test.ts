import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261119090000_identity_ocr_usage.sql'), 'utf8')

describe('identity OCR usage migration', () => {
  it('renames the tenant ledger and keeps it service-role-only without identity data', () => {
    expect(sql).toContain('alter table public.tenant_ocr_usage rename to identity_ocr_usage;')
    expect(sql).toContain('alter table public.identity_ocr_usage enable row level security;')
    expect(sql).toContain('revoke all on table public.identity_ocr_usage from public, anon, authenticated;')
    expect(sql).toMatch(/grant select, insert, update on table public\.identity_ocr_usage to service_role;/)
    for (const forbidden of ['full_name', 'id_number', 'image', 'prompt', 'response']) {
      expect(sql).not.toContain(forbidden)
    }
  })

  it('serializes reservations per UTC day with an advisory lock', () => {
    expect(sql).toContain("pg_advisory_xact_lock(hashtextextended('identity_ocr:'")
    expect(sql).toContain("at time zone 'utc'")
  })

  it('raises stable limit codes', () => {
    for (const code of ['IDENTITY_OCR_GLOBAL_LIMIT', 'IDENTITY_OCR_USER_LIMIT', 'IDENTITY_OCR_BUDGET']) {
      expect(sql).toContain(`'${code}'`)
    }
  })

  it('ignores released and stale reservations when counting', () => {
    expect(sql).toContain("status in ('reserved', 'settled')")
    expect(sql).toContain("interval '10 minutes'")
  })

  it.each([
    ['tenant_ocr_usage_date_idx', 'identity_ocr_usage_date_idx'],
    ['tenant_ocr_usage_date_user_idx', 'identity_ocr_usage_date_user_idx'],
  ])('renames index %s', (from, to) => {
    expect(sql).toContain(`alter index public.${from} rename to ${to};`)
  })

  it.each([
    ['reserve_tenant_ocr', 'uuid, integer, integer, bigint, bigint'],
    ['settle_tenant_ocr', 'uuid, bigint, integer, integer, text'],
    ['release_tenant_ocr', 'uuid'],
  ])('drops the old %s function', (fn, args) => {
    expect(sql).toContain(`drop function if exists public.${fn}(${args});`)
  })

  it.each([
    ['reserve_identity_ocr', 'uuid, integer, integer, bigint, bigint'],
    ['settle_identity_ocr', 'uuid, bigint, integer, integer, text'],
    ['release_identity_ocr', 'uuid'],
  ])('restricts %s to service_role', (fn, args) => {
    expect(sql).toContain(`revoke all on function public.${fn}(${args}) from public, anon, authenticated;`)
    expect(sql).toContain(`grant execute on function public.${fn}(${args}) to service_role;`)
  })
})
