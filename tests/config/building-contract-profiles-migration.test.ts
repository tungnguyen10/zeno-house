import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261111100000_building_contract_profiles.sql'), 'utf8')

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

  it('validates id number and copies', () => {
    expect(sql).toContain(`lessor_id_number ~ '^[0-9]{9}([0-9]{3})?$'`)
    expect(sql).toContain('copies_per_party * 2 <= signed_copies')
  })
})
