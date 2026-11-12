import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261112005547_inventory_lite.sql'), 'utf8')
const previous = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261001143337_contract_checkout_settlement.sql'), 'utf8')
const functions = [...sql.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\n\$\$;/g)]

describe('inventory lite migration (static checks; cloud SQL verification remains required)', () => {
  it.each(['building_inventory_templates', 'room_inventory_items', 'contract_inventory_items'])('locks %s to service_role without browser policies', (table) => {
    expect(sql).toContain(`alter table public.${table} enable row level security;`)
    expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated;`)
    expect(sql).toContain(`grant select, insert, update, delete on table public.${table} to service_role;`)
    expect(sql).not.toMatch(new RegExp(`create policy[\\s\\S]*?on public\\.${table}\\b`))
  })

  it('preserves existing production and renewal RPCs and defers issued-document locks', () => {
    expect(sql).not.toMatch(/function public\.(create_contract_with_handover|create_rooms_batch|renew_contract_atomic)\(/)
    expect(sql).not.toContain('before update on public.contract_inventory_items')
  })

  it('restricts every new function, including validation helpers', () => {
    expect(functions.length).toBeGreaterThanOrEqual(5)
    for (const [, name, body] of functions) {
      expect(body).toContain('security invoker')
      expect(body).toContain("set search_path = ''")
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`))
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to service_role;`))
    }
  })

  it('matches the latest 17 contract parameters before adding inventory', () => {
    const signature = previous.match(/function public\.create_contract_with_handover\(([\s\S]*?)\n\)/)?.[1]
    expect(signature).toBeTruthy()
    expect(sql).toContain(`${signature},\n  p_inventory jsonb`)
    expect(sql).toContain('from public.create_contract_with_handover(')
  })

  it('provides atomic replace RPCs and serializes all template/room writes by building', () => {
    for (const name of ['replace_inventory_template', 'replace_room_inventory', 'apply_inventory_template']) {
      const body = functions.find(([, fn]) => fn === name)?.[2] ?? ''
      expect(body).toContain("pg_advisory_xact_lock(hashtextextended('inventory:' ||")
      expect(body).toContain('delete from public.')
      expect(body).toContain('insert into public.')
    }
    expect(sql).toMatch(/from public\.rooms r[\s\S]*?for update/)
    expect(sql).toContain('INVENTORY_ROOM_SCOPE')
    expect(sql).toContain('INVENTORY_MODE_INVALID')
    expect(sql).toContain('INVENTORY_ROOMS_INVALID')
  })

  it('validates item shape, bounds, duplicates and submitted/merged list limits before writes', () => {
    expect(sql).toContain('jsonb_array_elements(p_items) with ordinality')
    expect(sql).toContain('INVENTORY_ITEMS_LIMIT')
    expect(sql).toContain('INVENTORY_ITEMS_INVALID')
    expect(sql).toContain('INVENTORY_ITEMS_DUPLICATE')
    expect(sql).toContain('999999999999')
    expect(sql).toContain("jsonb_typeof(v_item->'quantity')")
    expect(sql).toContain("jsonb_typeof(v_item->'unit_value')")
    expect(sql).toContain('v_merged_count > 50')
    expect(sql).toContain('cardinality(p_room_ids) > 200')
    expect(sql).not.toContain('jsonb_to_recordset(p_inventory)')
    expect(sql).toContain("(e.item->>'quantity')::numeric::integer")
    expect(sql).not.toContain("(e.item->>'quantity')::integer")
  })

  it('records bounded actor/building-bound batch replays', () => {
    expect(sql).toContain("'rooms.batch:' || p_request_id::text")
    expect(sql).toContain('v_op.actor_id is distinct from p_actor_id')
    expect(sql).toContain('v_op.building_id is distinct from p_building_id')
    expect(sql).toContain('BUILDING_SETUP_REQUEST_CONFLICT')
    expect(sql).toContain('r.building_id = p_building_id')
  })

  it('wraps migration in one transaction', () => {
    expect(sql).toMatch(/\nbegin;/)
    expect(sql.trim()).toMatch(/commit;$/)
  })

  it('provides a rolled-back human SQL gate with failing assertions for atomicity and privileges', () => {
    const verification = readFileSync(resolve(process.cwd(), 'supabase/verification/inventory_lite.sql'), 'utf8')
    expect(verification).toContain('set local role service_role;')
    expect(verification).toContain('VERIFY_FORCE_FAILURE')
    for (const assertion of ['atomic template replace', 'atomic room replace', 'mixed-building batch', 'bounded merge', 'batch replay', 'contract rollback', 'grants/settings']) {
      expect(verification).toContain(`raise exception 'VERIFY ${assertion}`)
    }
    expect(verification).toContain('has_function_privilege')
    expect(verification).toContain('has_table_privilege')
    expect(verification).toMatch(/\nrollback;/)
  })
})
