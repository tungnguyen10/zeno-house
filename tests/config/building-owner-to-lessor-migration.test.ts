import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261118090000_building_owner_to_lessor.sql'), 'utf8')
const flat = sql.replace(/\s+/g, ' ')

describe('building owner → lessor migration', () => {
  it('runs in one transaction', () => {
    expect(sql).toMatch(/^begin;/m)
    expect(sql).toMatch(/^commit;/m)
  })

  it('adds a bounded, validated lessor_email column', () => {
    expect(flat).toContain('add column if not exists lessor_email text')
    expect(flat).toContain('length(lessor_email) <= 254')
  })

  it('only fills empty lessor fields and never overwrites', () => {
    expect(flat).toContain('on conflict (building_id) do update set')
    for (const col of ['lessor_full_name', 'lessor_phone', 'lessor_email']) {
      expect(flat).toContain(`${col} = coalesce(public.building_contract_profiles.${col}, excluded.${col})`)
    }
  })

  it('filters values through the existing constraints before copying', () => {
    expect(flat).toContain('between 2 and 100')
    expect(flat).toContain("'^0[0-9]{9}$'")
  })

  it('handles international phones and excludes +84 format', () => {
    expect(flat).toContain("'^\\+[1-9][0-9]{7,14}$'")
    expect(flat).toMatch(/\+84.*then/) // ensures +84 cases are handled before international regex
  })

  it('does not drop or modify buildings.owner_* columns', () => {
    expect(flat).not.toMatch(/alter table public\.buildings/i)
    expect(flat).not.toMatch(/drop column/i)
  })
})
