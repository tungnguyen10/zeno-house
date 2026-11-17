import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261117090000_contract_inventory_rpcs.sql'),
  'utf8',
)

function definition(name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`)
  expect(start, `Missing public.${name}`).toBeGreaterThanOrEqual(0)
  const end = sql.indexOf('$$;', start)
  return sql.slice(start, end + 3).replace(/\s+/g, ' ')
}

describe('contract inventory RPC migration', () => {
  it('runs in one transaction', () => {
    expect(sql).toMatch(/^begin;/m)
    expect(sql).toMatch(/^commit;/m)
  })

  it.each(['replace_contract_inventory', 'find_handover_inventory'])('keeps %s invoker-only and service-role-only', (name) => {
    expect(definition(name)).toContain('security invoker')
    expect(definition(name)).toContain("set search_path = ''")
    expect(sql).toMatch(new RegExp(`revoke all on function public\\.${name}\\([^;]*\\) from public, anon, authenticated;`, 'i'))
    expect(sql).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^;]*\\) to service_role;`, 'i'))
  })

  it('replace_contract_inventory locks, rejects issued documents and validates before deleting', () => {
    const def = definition('replace_contract_inventory')
    const lock = def.indexOf('for update')
    const issued = def.indexOf('CONTRACT_INVENTORY_LOCKED')
    const validate = def.indexOf('validate_inventory_items')
    const del = def.indexOf('delete from public.contract_inventory_items')
    expect(lock).toBeGreaterThan(-1)
    expect(lock).toBeLessThan(issued)
    expect(issued).toBeLessThan(validate)
    expect(validate).toBeLessThan(del)
    expect(def).toContain("d.status in ('issued', 'signed')")
  })

  it('find_handover_inventory bounds the recursive walk', () => {
    const def = definition('find_handover_inventory')
    expect(def).toContain('with recursive')
    expect(def).toMatch(/depth < 19/)
  })
})
