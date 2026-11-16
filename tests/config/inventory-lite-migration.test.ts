import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261111110000_inventory_lite.sql'), 'utf8')

describe('inventory lite migration', () => {
  it.each(['building_inventory_templates', 'room_inventory_items', 'contract_inventory_items'])('locks %s to service_role', (table) => {
    expect(sql).toContain(`alter table public.${table} enable row level security;`)
    expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated;`)
  })

  it('does not redefine existing production RPCs', () => {
    expect(sql).not.toMatch(/function public\.create_contract_with_handover\(/)
    expect(sql).not.toMatch(/function public\.create_rooms_batch\(/)
  })

  it('does not add an update-block trigger (PR4b owns the post-issuance lock)', () => {
    expect(sql).not.toContain('before update on public.contract_inventory_items')
  })

  it('restricts new functions to service_role', () => {
    for (const fn of ['apply_inventory_template', 'create_rooms_batch_idempotent', 'create_contract_with_handover_and_inventory']) {
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`))
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`))
    }
  })
})
