import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260611000000_billing_runtime.sql'), 'utf8')
const executableSql = sql
  .split('\n')
  .filter(line => !line.trimStart().startsWith('--'))
  .join('\n')

const tables = [
  'billing_periods',
  'invoices',
  'invoice_charges',
  'invoice_payments',
  'billing_utility_usages',
  'billing_audit_events',
]

describe('billing runtime SQL RLS', () => {
  it('enables row level security for every new billing table', () => {
    for (const table of tables) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`, 'i'))
    }
  })

  it('uses auth.jwt app_metadata role policies for admin and manager access', () => {
    for (const table of tables) {
      expect(sql).toContain(`${table}_admin_all`)
      expect(sql).toContain(`ON public.${table}`)
    }

    expect(sql).toContain("auth.jwt() -> 'app_metadata' ->> 'role'")
    expect(sql).toContain("= 'admin'")
    expect(sql).toContain("= 'manager'")
    expect(executableSql).not.toContain('auth.role()')
  })

  it('keeps audit events append-only for managers', () => {
    expect(sql).toContain('billing_audit_events_manager_select')
    expect(sql).toContain('billing_audit_events_manager_insert')
    expect(sql).not.toContain('billing_audit_events_manager_update')
    expect(sql).not.toContain('billing_audit_events_manager_delete')
  })
})
