import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261105032920_tenant_scoped_bulk_status.sql'), 'utf8').toLowerCase()

// Structural guards complement the transactional staging script; they do not execute PostgreSQL.
describe('tenant scoped bulk status migration', () => {
  it('restricts an invoker with an empty search path to the service role', () => {
    expect(sql).toContain('function public.bulk_tenant_status_action(')
    expect(sql).toContain('security invoker')
    expect(sql).toContain("set search_path = ''")
    expect(sql).not.toContain('security definer')
    expect(sql).toMatch(/revoke all on function public\.bulk_tenant_status_action\(text, jsonb\) from public, anon, authenticated/)
    expect(sql).toMatch(/grant execute on function public\.bulk_tenant_status_action\(text, jsonb\) to service_role/)
    expect(sql).not.toContain('bulk_master_data_action')
  })

  it('validates inputs and deterministically deduplicates and orders tenant locks', () => {
    expect(sql).toContain("p_action not in ('archive', 'activate')")
    expect(sql).toContain("pg_catalog.jsonb_typeof(item.value -> 'expected_building_ids') is distinct from 'array'")
    expect(sql).toContain('distinct on (requested.tenant_id)')
    expect(sql).toContain('order by requested.tenant_id, requested.ordinality')
    expect(sql).toContain('order by unique_items.tenant_id')
    expect(sql).toContain('for update')
  })

  it('compares the exact active primary/open occupant union after locking and before mutation', () => {
    const lock = sql.indexOf('for update')
    const facts = sql.indexOf('into v_actual_building_ids', lock)
    const compare = sql.indexOf('v_actual_building_ids is distinct from v_expected_building_ids', facts)
    const update = sql.indexOf('update public.tenants', compare)
    expect(lock).toBeGreaterThan(0)
    expect(facts).toBeGreaterThan(lock)
    expect(compare).toBeGreaterThan(facts)
    expect(update).toBeGreaterThan(compare)
    expect(sql).toContain("c.status = 'active'")
    expect(sql).toContain('o.move_out_date is null')
    expect(sql).toMatch(/join public\.contracts c on c\.id = o\.contract_id\s+where o\.tenant_id = v_item\.tenant_id\s+and o\.move_out_date is null/)
    expect(sql).not.toMatch(/current_date|c\.end_date|c\.start_date/)
    expect(sql).toContain("when 'archive' then 'archived' else 'active' end")
    expect(sql).toContain("reason := 'not_found'")
    expect(sql).toContain("reason := 'conflict'")
  })
})
