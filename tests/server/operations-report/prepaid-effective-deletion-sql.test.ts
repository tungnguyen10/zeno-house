import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(
  process.cwd(),
  'supabase/sql-editor/phase-2-report-and-bulk-rpcs.sql',
), 'utf8').toLowerCase()

describe('operations report prepaid effective window SQL', () => {
  it('preserves historical expired and cancelled allocations by date window', () => {
    expect(sql).toContain('create or replace function public.operations_report_snapshot')
    expect(sql).toContain('security invoker')
    expect(sql).toContain('p.start_date <= make_date(p_period_year, p_period_month, 1)')
    expect(sql).toContain('p.end_date > make_date(p_period_year, p_period_month, 1)')
    expect(sql).not.toContain("p.status = 'active'")
    expect(sql).toContain(
      'grant execute on function public.operations_report_snapshot(uuid, integer, integer) to service_role',
    )
  })
})
