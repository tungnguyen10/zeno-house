import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationsDir = join(process.cwd(), 'supabase/migrations')
function migration(suffix: string): string {
  const name = readdirSync(migrationsDir).find(file => file.endsWith(suffix))
  if (!name) throw new Error(`Missing migration *${suffix}`)
  return readFileSync(join(migrationsDir, name), 'utf8').toLowerCase()
}

describe('tenant identity conflict limit migration', () => {
  const sql = migration('_tenant_identity_conflict_limit.sql')

  it('allows the new scope on the shared bucket table', () => {
    expect(sql).toContain("check (scope in ('chat', 'action', 'tenant_identity_conflict'))")
  })

  it('exposes peek and record functions to service_role only', () => {
    for (const fn of ['peek_tenant_identity_conflict_limit', 'record_tenant_identity_conflicts']) {
      expect(sql).toContain(`create or replace function public.${fn}(`)
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([\\s\\S]+?from public, anon, authenticated`))
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([\\s\\S]+?to service_role`))
    }
  })
})

describe('harden tenant identity data migration', () => {
  const sql = migration('_harden_tenant_identity_data.sql')

  it('aborts when normalized duplicates remain', () => {
    expect(sql).toContain("raise exception 'tenant_identity_duplicates")
  })

  it('normalizes existing rows before creating unique indexes', () => {
    const update = sql.indexOf('update public.tenants')
    expect(update).toBeGreaterThan(-1)
    expect(sql.indexOf('create unique index tenants_phone_uq')).toBeGreaterThan(update)
    expect(sql).toContain('create unique index tenants_id_number_uq on public.tenants (id_number) where id_number is not null')
  })

  it('normalizes every later write through a trigger', () => {
    expect(sql).toContain('before insert or update of phone, id_number on public.tenants')
  })
})

describe('verification fixtures', () => {
  it.each(['atomic_billing_close.sql', 'atomic_contract_renewal.sql', 'tenant_scoped_bulk_status.sql'])(
    '%s no longer reuses one phone for several tenants',
    (file) => {
      const sql = readFileSync(join(process.cwd(), 'supabase/verification', file), 'utf8')
      expect(sql).not.toContain("'0900000000'")
    },
  )
})


describe('migration safety', () => {
  it('locks tenants before checking duplicates and keeps the rollout atomic', () => {
    const sql = migration('_harden_tenant_identity_data.sql')
    expect(sql).toMatch(/begin;[\s\S]*lock table public\.tenants in share row exclusive mode/)
    expect(sql.indexOf('lock table public.tenants')).toBeLessThan(sql.indexOf('v_phone_groups integer'))
    expect(sql).toContain('commit;')
  })

  it('rejects null rate-limit inputs and uses an atomic counter increment', () => {
    const sql = migration('_tenant_identity_conflict_limit.sql')
    expect(sql.match(/p_now is null/g)).toHaveLength(2)
    expect(sql).toContain('p_limit is null')
    expect(sql).toContain('p_units is null')
    expect(sql.match(/p_window_seconds is null/g)).toHaveLength(2)
    expect(sql).toContain('public.ai_rate_limit_buckets.request_count + p_units')
  })

  it('preflight reports group membership without selecting identity keys', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/verification/tenant_identity_duplicates.sql'), 'utf8').toLowerCase()
    expect(sql).toContain('select kind, group_no, group_size, id as tenant_id, code')
    expect(sql).not.toContain('full_name')
    expect(sql).toContain('pg_catalog.pg_trigger')
  })

  it('verification checks the exact violated constraint and rolls every write back', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/verification/harden_tenant_identity_data.sql'), 'utf8').toLowerCase()
    expect(sql).toContain('get stacked diagnostics')
    expect(sql).toContain("'tenants_phone_uq'")
    expect(sql).toContain("'tenants_id_number_uq'")
    expect(sql).toContain('record_tenant_identity_conflicts')
    expect(sql).toContain('rollback;')
  })
})


describe('SQL and TypeScript normalization parity', () => {
  const whitespace = String.raw`\0009\000a\000b\000c\000d\0020\00a0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200a\2028\2029\202f\205f\3000\feff`

  it('uses the full ECMAScript whitespace repertoire in migration and preflight', () => {
    const sql = migration('_harden_tenant_identity_data.sql')
    const preflight = readFileSync(join(process.cwd(), 'supabase/verification/tenant_identity_duplicates.sql'), 'utf8').toLowerCase()
    for (const source of [sql, preflight]) {
      expect(source.split(`u&'${whitespace}'`)).toHaveLength(3)
      expect(source).toContain('pg_catalog.translate(')
      expect(source).toContain('collate pg_catalog."und-x-icu"')
      expect(source).not.toContain('[[:space:]]')
      expect(source).not.toContain('[[:space:].()-]')
    }
  })

  it('keeps the executable cloud SQL fixture generated from the shared JSON fixture', () => {
    expect(() => execFileSync(process.execPath, [
      'scripts/generate-tenant-identity-sql-fixture.mjs', '--check',
    ], { cwd: process.cwd(), encoding: 'utf8' })).not.toThrow()
    const sql = readFileSync(join(process.cwd(), 'supabase/verification/tenant_identity_normalization.sql'), 'utf8')
    expect(sql).toContain('public.normalize_tenant_phone')
    expect(sql).toContain('public.normalize_tenant_id_number')
    expect(sql).toContain('is distinct from')
    expect(sql).toContain('raise exception')
  })
})
