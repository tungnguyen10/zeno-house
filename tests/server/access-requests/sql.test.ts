import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
const migrationName = readdirSync(migrationsDir)
  .find(name => name.endsWith('_add_pending_account_approval.sql'))
const sql = migrationName
  ? readFileSync(resolve(migrationsDir, migrationName), 'utf8')
  : ''
const verification = readFileSync(resolve(process.cwd(), 'supabase/verification/pending_account_approval.sql'), 'utf8')
const fencingSql = readFileSync(resolve(migrationsDir, '20260719093000_fence_access_request_approval.sql'), 'utf8')
const correctionMigrationName = readdirSync(migrationsDir)
  .find(name => name.endsWith('_fix_provisioned_access_request_trigger.sql'))
const correctionSql = correctionMigrationName
  ? readFileSync(resolve(migrationsDir, correctionMigrationName), 'utf8')
  : ''

describe('pending account approval migration', () => {
  it('creates one access request per auth user with a constrained lifecycle', () => {
    expect(migrationName).toBeTruthy()
    expect(sql).toMatch(/create table public\.access_requests/i)
    expect(sql).toMatch(/auth_user_id\s+uuid\s+not null\s+unique\s+references auth\.users\(id\)\s+on delete cascade/i)
    expect(sql).toMatch(/status\s+text\s+not null\s+default 'pending'/i)
    expect(sql).toMatch(/check\s*\(status in \('pending', 'processing', 'approved', 'rejected'\)\)/i)
  })

  it('fences approvals and tags the exact grants created by each claim', () => {
    expect(fencingSql).toContain('alter table public.access_requests')
    expect(fencingSql).toContain('alter table public.user_building_assignments')
    expect(fencingSql).toContain('alter table public.tenant_user_links')
    expect(fencingSql.match(/approval_claim_token uuid/g)).toHaveLength(3)
  })

  it('captures only auth users that have no application role', () => {
    expect(sql).toMatch(/create trigger auth_user_create_pending_access_request/i)
    expect(sql).toMatch(/after insert on auth\.users/i)
    expect(sql).toContain("new.raw_app_meta_data ->> 'role'")
    expect(sql).toMatch(/on conflict \(auth_user_id\) do nothing/i)
  })

  it('defers eligibility until Auth metadata reaches its final transaction state', () => {
    expect(correctionMigrationName).toBeTruthy()
    expect(correctionSql).toMatch(/create constraint trigger auth_user_create_pending_access_request/i)
    expect(correctionSql).toMatch(/deferrable initially deferred/i)
    expect(correctionSql).toMatch(/from auth\.users[\s\S]*where auth_user\.id = new\.id/i)
    expect(correctionSql).toMatch(/current_app_meta_data\s*->>\s*'role'/i)
    expect(correctionSql).not.toMatch(/if nullif\(new\.raw_app_meta_data\s*->>\s*'role'/i)
  })

  it('audits and removes only untouched stale pending requests', () => {
    expect(correctionSql).toContain("'user.access_request.reconciled'")
    expect(correctionSql).toContain("'provisioned_role_present'")
    expect(correctionSql).toMatch(/target\.status = 'pending'/i)
    expect(correctionSql).toMatch(/target\.approval_claim_token is null/i)
    expect(correctionSql).toMatch(/target\.reviewed_by is null/i)
    expect(correctionSql).toMatch(/target\.decision_role is null/i)
    expect(correctionSql).toMatch(/cardinality\(target\.decision_building_ids\) = 0/i)
    expect(correctionSql).toMatch(/target\.decision_tenant_id is null/i)
    expect(correctionSql).toMatch(/target\.rejection_reason is null/i)
    expect(correctionSql).toMatch(/delete from public\.access_requests/i)
  })

  it('keeps the table private behind service role access', () => {
    expect(sql).toMatch(/alter table public\.access_requests enable row level security/i)
    expect(sql).toMatch(/revoke all on table public\.access_requests from anon, authenticated/i)
    expect(sql).toMatch(/grant all on table public\.access_requests to service_role/i)
    expect(sql).not.toMatch(/create policy/i)
  })

  it('writes the creation audit and marker atomically under a row lock', () => {
    expect(sql).toMatch(/create or replace function public\.append_access_request_created_audit/i)
    expect(sql).toMatch(/for update/i)
    expect(sql).toMatch(/insert into public\.audit_events/i)
    expect(sql).toMatch(/set created_audited_at = now\(\)/i)
    expect(sql).toMatch(/grant execute on function public\.append_access_request_created_audit\(uuid, uuid\) to service_role/i)
  })

  it('provides rollback-safe behavioral verification with fail-fast assertions', () => {
    expect(verification).toMatch(/^begin;/im)
    expect(verification).toMatch(/insert into auth\.users/i)
    expect(verification).toMatch(/set local role authenticated/i)
    expect(verification).toMatch(/raise exception 'missing-role auth user did not create a pending request'/i)
    expect(verification).toMatch(/raise exception 'authenticated role could read access_requests directly'/i)
    expect(verification).toMatch(/set constraints auth_user_create_pending_access_request immediate/i)
    expect(verification).toMatch(/update auth\.users[\s\S]*raw_app_meta_data[\s\S]*role/i)
    expect(verification).toMatch(/raise exception 'deferred provisioned auth user unexpectedly created a pending request'/i)
    expect(verification).toMatch(/raise exception 'role-bearing auth user retained an untouched pending request'/i)
    expect(verification).toMatch(/rollback;/i)
  })
})
