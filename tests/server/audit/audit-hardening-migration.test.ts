import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationName = readdirSync(join(process.cwd(), 'supabase/migrations'))
  .find(name => name.endsWith('_harden_event_audit.sql'))

function migrationSql(): string {
  expect(migrationName, 'harden_event_audit migration').toBeTruthy()
  return readFileSync(join(process.cwd(), 'supabase/migrations', migrationName!), 'utf8').toLowerCase()
}

describe('event audit hardening migration', () => {
  it('preserves audit history when buildings and periods are deleted', () => {
    const sql = migrationSql()
    expect(sql).toContain('drop constraint if exists audit_events_building_id_fkey')
    expect(sql).toContain('add column if not exists building_name_snapshot')
    expect(sql).toContain('add column if not exists building_id uuid')
    expect(sql).toContain('add column if not exists period_year integer')
    expect(sql).toContain('on delete set null')
    expect(sql).not.toMatch(/audit_events[\s\S]{0,300}building_id[\s\S]{0,100}on delete cascade/)
  })

  it('adds idempotent audit operations and event operation ids', () => {
    const sql = migrationSql()
    expect(sql).toContain('create table if not exists public.audit_operations')
    expect(sql).toContain('idempotency_key text not null unique')
    expect(sql).toContain('add column if not exists operation_id uuid')
    expect(sql).toContain('create unique index if not exists idx_audit_events_operation')
    expect(sql).toContain('create or replace function public.complete_audit_operation')
    expect(sql).toContain('create or replace function public.claim_stale_audit_operations')
  })

  it('revokes browser table access and restricts mutating RPCs to service role', () => {
    const sql = migrationSql()
    expect(sql).toContain('revoke all on table public.audit_events from public, anon, authenticated')
    expect(sql).toContain('revoke all on table public.billing_audit_events from public, anon, authenticated')
    expect(sql).toContain('grant select, insert, update on table public.audit_operations to service_role')
    expect(sql).toContain('grant execute on function public.update_invoice_email_settings_with_audit')
    expect(sql).toContain('grant execute on function public.refresh_invoice_profile_snapshot_with_audit')
  })

  it('atomically audits invoice email settings and profile snapshot refresh', () => {
    const sql = migrationSql()
    expect(sql).toContain('create or replace function public.update_invoice_email_settings_with_audit')
    expect(sql).toContain("'building.invoice_email_settings.updated'")
    expect(sql).toContain('create or replace function public.refresh_invoice_profile_snapshot_with_audit')
    expect(sql).toContain("'invoice.profile_snapshot.refreshed'")
  })
})
