import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260716233954_add_tenant_documents.sql',
)
const sql = readFileSync(migrationPath, 'utf8')
const identityMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260717001405_tenant_self_identity_images.sql',
)
const identitySql = readFileSync(identityMigrationPath, 'utf8')

function policy(name: string): string {
  const match = sql.match(new RegExp(`create policy ${name}[\\s\\S]*?;`, 'i'))
  expect(match, `missing policy ${name}`).not.toBeNull()
  return match![0]
}

describe('tenant document storage migration', () => {
  it('creates a private document bucket with the server upload limits', () => {
    expect(sql).toMatch(/insert into storage\.buckets/i)
    expect(sql).toContain("'tenant-documents'")
    expect(sql).toMatch(/false,\s*5242880,/i)
    expect(sql).toContain("array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']")
  })

  it.each([
    ['tenant_documents_self_select', 'for select', 'using'],
    ['tenant_documents_self_insert', 'for insert', 'with check'],
    ['tenant_documents_self_delete', 'for delete', 'using'],
  ])('links %s to the active tenant id stored in the first path segment', (name, operation, clause) => {
    const statement = policy(name)

    expect(statement).toContain(operation)
    expect(statement).toContain(clause)
    expect(statement).toContain("bucket_id = 'tenant-documents'")
    expect(statement).toContain('public.tenant_user_links')
    expect(statement).toContain('link.auth_user_id = (select auth.uid())')
    expect(statement).toContain("link.status = 'active'")
    expect(statement).toContain("link.tenant_id::text = split_part(storage.objects.name, '/', 1)")
    expect(statement).not.toMatch(/auth\.uid\(\).*foldername|foldername.*auth\.uid\(\)/i)
  })

  it('retains an admin-all policy on the dedicated bucket', () => {
    const statement = policy('tenant_documents_admin_all')

    expect(statement).toContain('for all')
    expect(statement).toContain("bucket_id = 'tenant-documents'")
    expect(statement).toContain("(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'")
  })
})

function identityPolicy(name: string): string {
  const match = identitySql.match(new RegExp(`create policy ${name}[\\s\\S]*?;`, 'i'))
  expect(match, `missing policy ${name}`).not.toBeNull()
  return match![0]
}

describe('tenant identity-image self-service migration', () => {
  it('keeps the existing identity bucket private and image-only', () => {
    expect(identitySql).toContain("'tenant-id-images'")
    expect(identitySql).toMatch(/public\s*=\s*false/i)
    expect(identitySql).toMatch(/file_size_limit\s*=\s*5242880/i)
    expect(identitySql).toContain("array['image/jpeg', 'image/png', 'image/webp']")
    expect(identitySql).toContain('tenant_id_images_admin_all')
  })

  it.each([
    ['tenant_id_images_self_select', 'for select', 'using'],
    ['tenant_id_images_self_insert', 'for insert', 'with check'],
    ['tenant_id_images_self_delete', 'for delete', 'using'],
  ])('links %s to the active tenant id in the first path segment', (name, operation, clause) => {
    const statement = identityPolicy(name)

    expect(statement).toContain(operation)
    expect(statement).toContain(clause)
    expect(statement).toContain("bucket_id = 'tenant-id-images'")
    expect(statement).toContain('public.tenant_user_links')
    expect(statement).toContain('link.auth_user_id = (select auth.uid())')
    expect(statement).toContain("link.status = 'active'")
    expect(statement).toContain("link.tenant_id::text = split_part(storage.objects.name, '/', 1)")
    expect(statement).toContain("split_part(storage.objects.name, '/', 2) in ('front', 'back')")
  })
})
