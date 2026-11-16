import { readdirSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('breaks only the legacy manager occupancy policy edge without granting broader access', () => {
  const name = readdirSync('supabase/migrations').find(name => name.endsWith('_fix_support_request_policy_recursion.sql'))
  expect(name).toBeDefined()
  const sql = readFileSync(`supabase/migrations/${name}`, 'utf8').toLowerCase()
  expect(sql).toContain('drop policy if exists contract_occupants_manager_select on public.contract_occupants')
  expect(sql).not.toContain('security definer')
  expect(sql).not.toContain('grant ')
  expect(sql).not.toContain('delete from')
})
