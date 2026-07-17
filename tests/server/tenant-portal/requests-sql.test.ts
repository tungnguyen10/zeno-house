import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260717171947_add_tenant_support_requests.sql',
)
const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : ''
const attachmentScopeMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260717221849_harden_support_request_attachment_scope.sql',
)
const attachmentScopeSql = existsSync(attachmentScopeMigrationPath)
  ? readFileSync(attachmentScopeMigrationPath, 'utf8')
  : ''

function policy(name: string): string {
  const match = sql.match(new RegExp(`create policy ${name}[\\s\\S]*?;`, 'i'))
  expect(match, `missing policy ${name}`).not.toBeNull()
  return match![0]
}

describe('tenant support request migration', () => {
  it('creates the support request model with server-owned context and minimal statuses', () => {
    expect(existsSync(migrationPath)).toBe(true)
    expect(sql).toMatch(/create table public\.support_requests/i)
    expect(sql).toMatch(/tenant_id\s+uuid\s+not null\s+references public\.tenants\(id\)/i)
    expect(sql).toMatch(/building_id\s+uuid\s+not null\s+references public\.buildings\(id\)/i)
    expect(sql).toMatch(/contract_id\s+uuid\s+not null\s+references public\.contracts\(id\)/i)
    expect(sql).toMatch(/title\s+text\s+not null/i)
    expect(sql).toMatch(/description\s+text\s+not null/i)
    expect(sql).toMatch(/status\s+text\s+not null\s+default 'new'/i)
    expect(sql).toMatch(/check\s*\(status in \('new', 'in_progress', 'resolved'\)\)/i)
    expect(sql).toMatch(/attachment_path\s+text/i)
    expect(sql).toMatch(/created_at\s+timestamptz\s+not null\s+default now\(\)/i)
    expect(sql).toMatch(/updated_at\s+timestamptz\s+not null\s+default now\(\)/i)
    expect(sql).toContain('support_requests_set_updated_at')
  })

  it('enables RLS and grants only the operations required by direct authenticated access', () => {
    expect(sql).toMatch(/alter table public\.support_requests enable row level security/i)
    expect(sql).toMatch(/revoke all on table public\.support_requests from anon, authenticated/i)
    expect(sql).toMatch(/grant select, insert on table public\.support_requests to authenticated/i)
    expect(sql).toMatch(/grant all on table public\.support_requests to service_role/i)
  })

  it.each([
    ['support_requests_tenant_select_own', 'for select', 'using'],
    ['support_requests_tenant_insert_own', 'for insert', 'with check'],
  ])('scopes %s through the active tenant link', (name, operation, clause) => {
    const statement = policy(name)

    expect(statement).toContain(operation)
    expect(statement).toContain(clause)
    expect(statement).toContain("(auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'")
    expect(statement).toContain('public.tenant_user_links')
    expect(statement).toContain('link.auth_user_id = (select auth.uid())')
    expect(statement).toContain("link.status = 'active'")
    expect(statement).toContain('link.tenant_id = support_requests.tenant_id')
  })

  it('allows admin globally and scopes owners and managers through assignments', () => {
    const admin = policy('support_requests_admin_select_all')
    const operator = policy('support_requests_operator_select_assigned')

    expect(admin).toContain("(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'")
    expect(operator).toContain("in ('owner', 'manager')")
    expect(operator).toContain('public.user_building_assignments')
    expect(operator).toContain('assignment.user_id = (select auth.uid())')
    expect(operator).toContain('assignment.building_id = support_requests.building_id')
  })

  it.each(['tenant_id', 'building_id', 'status'])('indexes %s', (column) => {
    expect(sql).toMatch(new RegExp(`create index[^;]+support_requests[^;]+\\(${column}\\)`, 'i'))
  })

  it('rejects direct inserts whose attachment path is outside the tenant request prefix', () => {
    expect(existsSync(attachmentScopeMigrationPath)).toBe(true)
    expect(attachmentScopeSql).toMatch(/drop policy if exists support_requests_tenant_insert_own/i)
    expect(attachmentScopeSql).toMatch(/create policy support_requests_tenant_insert_own/i)
    expect(attachmentScopeSql).toContain("split_part(attachment_path, '/', 1) = support_requests.tenant_id::text")
    expect(attachmentScopeSql).toContain("split_part(attachment_path, '/', 2) = 'requests'")
    expect(attachmentScopeSql).toContain("split_part(attachment_path, '/', 3) <> ''")
  })
})
