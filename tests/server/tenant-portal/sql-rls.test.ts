import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260716083605_add_tenant_identity_foundation.sql',
)
const sql = readFileSync(migrationPath, 'utf8')
const executableSql = sql
  .split('\n')
  .filter(line => !line.trimStart().startsWith('--'))
  .join('\n')

describe('tenant identity linkage migration', () => {
  it('creates a one-to-one auth-user to tenant link with status and timestamps', () => {
    expect(sql).toMatch(/create table public\.tenant_user_links/i)
    expect(sql).toMatch(/auth_user_id\s+uuid\s+not null\s+references auth\.users\(id\)\s+on delete cascade/i)
    expect(sql).toMatch(/tenant_id\s+uuid\s+not null\s+references public\.tenants\(id\)\s+on delete cascade/i)
    expect(sql).toMatch(/status\s+text\s+not null\s+default 'active'/i)
    expect(sql).toMatch(/check\s*\(status in \('active', 'disabled'\)\)/i)
    expect(sql).toMatch(/unique\s*\(auth_user_id\)/i)
    expect(sql).toMatch(/unique\s*\(tenant_id\)/i)
    expect(sql).toMatch(/created_at\s+timestamptz\s+not null\s+default now\(\)/i)
    expect(sql).toMatch(/updated_at\s+timestamptz\s+not null\s+default now\(\)/i)
  })

  it('enables RLS and permits tenants to select only their own link', () => {
    expect(sql).toMatch(/alter table public\.tenant_user_links\s+enable row level security/i)
    expect(sql).toContain('tenant_user_links_tenant_select_own')
    expect(sql).toContain("(auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'")
    expect(sql).toContain('auth_user_id = (select auth.uid())')
    expect(sql).toMatch(/grant select on table public\.tenant_user_links to authenticated/i)
  })
})

describe('tenant-readable RLS baseline', () => {
  it.each([
    ['tenants', 'link.tenant_id = tenants.id'],
    ['contracts', 'link.tenant_id = contracts.tenant_id'],
    ['invoices', 'link.tenant_id = invoices.tenant_id'],
  ]) (
    'adds an active-link self-select policy for %s',
    (table, tenantPredicate) => {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table}\\s+enable row level security`, 'i'))
      expect(sql).toContain(`${table}_tenant_select_own`)
      expect(sql).toContain(tenantPredicate)
    },
  )

  it('scopes every tenant read through tenant_user_links and auth.uid()', () => {
    const policyMatches = sql.match(/create policy [\s\S]*?;/gi) ?? []
    const tenantPolicies = policyMatches.filter(policy => policy.includes('_tenant_select_own'))

    expect(tenantPolicies).toHaveLength(4)
    for (const policy of tenantPolicies) {
      expect(policy).toContain("(auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'")
      expect(policy).toContain('(select auth.uid())')
    }

    for (const policy of tenantPolicies.slice(1)) {
      expect(policy).toContain('public.tenant_user_links')
      expect(policy).toContain("link.status = 'active'")
    }
  })

  it('grants direct read but defines no tenant write policies', () => {
    expect(sql).toMatch(/grant select on table public\.tenants, public\.contracts, public\.invoices to authenticated/i)
    expect(executableSql).not.toMatch(/create policy \S*tenant\S*[\s\S]*?for (insert|update|delete|all)/i)
  })
})
