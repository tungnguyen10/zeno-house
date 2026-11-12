import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261111172755_building_contract_profiles.sql'), 'utf8')

describe('building_contract_profiles migration', () => {
  it('creates a 1:1 table cascading with buildings', () => {
    expect(sql).toContain('create table if not exists public.building_contract_profiles')
    expect(sql).toContain('building_id uuid primary key references public.buildings(id) on delete cascade')
  })

  it('locks the table to service_role', () => {
    expect(sql).toContain('alter table public.building_contract_profiles enable row level security;')
    expect(sql).toContain('revoke all on table public.building_contract_profiles from public, anon, authenticated;')
    expect(sql).toContain('grant select, insert, update, delete on table public.building_contract_profiles to service_role;')
    expect(sql).not.toMatch(/create policy/i)
  })

  it('validates identity and copy counts', () => {
    expect(sql).toContain("lessor_id_number ~ '^[0-9]{9}([0-9]{3})?$'")
    expect(sql).toContain('lessor_id_issued_date <= current_date')
    expect(sql).toContain('signed_copies integer not null default 2 check (signed_copies between 1 and 10)')
    expect(sql).toContain('copies_per_party integer not null default 1 check (copies_per_party between 1 and 5)')
    expect(sql).toContain('copies_per_party * 2 <= signed_copies')
  })

  it('bounds optional policy defaults without inventing default values', () => {
    for (const [field, type, range] of [
      ['default_term_months', 'integer', 'between 1 and 60'],
      ['default_deposit_months', 'numeric(3,1)', 'between 0 and 6'],
      ['notice_days', 'integer', 'between 0 and 180'],
      ['deposit_refund_days', 'integer', 'between 0 and 90'],
      ['renewal_months', 'integer', 'between 0 and 24'],
      ['extra_occupant_fee', 'numeric(12,0)', '>= 0'],
      ['drilling_fee', 'numeric(12,0)', '>= 0'],
      ['fingerprint_reset_fee', 'numeric(12,0)', '>= 0'],
    ]) {
      expect(sql).toContain(`${field} ${type} check (${field} is null or ${field} ${range})`)
    }
  })

  it('tracks the updater and maintains timestamps', () => {
    expect(sql).toContain('updated_by uuid references auth.users(id) on delete set null')
    expect(sql).toContain('created_at timestamptz not null default now()')
    expect(sql).toContain('updated_at timestamptz not null default now()')
    expect(sql).toMatch(/create trigger building_contract_profiles_set_updated_at\s+before update on public\.building_contract_profiles\s+for each row execute function public\.set_updated_at\(\);/)
  })
})
