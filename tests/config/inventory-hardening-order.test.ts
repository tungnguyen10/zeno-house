import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8')

const hardened = migration('20261112005547_inventory_lite.sql')
const replayFix = migration('20261116100000_inventory_lite_functions_hardening.sql')
const requiredFunctions = [
  'apply_inventory_template',
  'create_rooms_batch_idempotent',
  'create_contract_with_handover_and_inventory',
] as const

function definition(sql: string, name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`)
  expect(start, `Missing public.${name}`).toBeGreaterThanOrEqual(0)
  const end = sql.indexOf('$$;', start)
  expect(end, `Unterminated public.${name}`).toBeGreaterThan(start)
  return sql.slice(start, end + 3).replace(/\s+/g, ' ').trim()
}

describe('Inventory Lite migrations applied in timestamp order', () => {
  it.each(requiredFunctions)('restores the exact hardened %s definition after the older migration', (name) => {
    // Production received the 20261111110000 definitions after the stricter
    // 20261112005547 functions. The later forward migration must restore them.
    expect(definition(replayFix, name)).toEqual(definition(hardened, name))
  })

  it.each(requiredFunctions)('keeps %s service-role-only with invoker security', (name) => {
    const sql = definition(replayFix, name)
    expect(sql).toContain('security invoker')
    expect(sql).toContain("set search_path = ''")
    const grants = new RegExp(`grant execute on function public\\.${name}\\([^;]*\\) to service_role;`, 'i')
    const revokes = new RegExp(`revoke all on function public\\.${name}\\([^;]*\\) from public, anon, authenticated;`, 'i')
    expect(replayFix).toMatch(grants)
    expect(replayFix).toMatch(revokes)
  })

  it('keeps both atomic replacement RPCs available for direct inventory saves', () => {
    for (const name of ['replace_inventory_template', 'replace_room_inventory']) {
      expect(definition(hardened, name)).toContain('delete from public.')
      expect(hardened).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^;]*\\) to service_role;`, 'i'))
    }
  })
})
