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

const rpcSql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260626000000_billing_transaction_rpcs.sql'),
  'utf8',
)

describe('billing transaction RPCs SQL', () => {
  it('defines issue_period_invoices with advisory lock + invariant + audit', () => {
    expect(rpcSql).toMatch(/CREATE OR REPLACE FUNCTION public\.issue_period_invoices/)
    expect(rpcSql).toMatch(/RETURNS SETOF public\.invoices/)
    expect(rpcSql).toMatch(/pg_advisory_xact_lock\s*\(\s*hashtextextended/)
    // Per-draft sum invariant
    expect(rpcSql).toMatch(/invoice line sum .* does not match declared total/)
    // Period status + invoices.issued audit
    expect(rpcSql).toContain("'period.status_changed'")
    expect(rpcSql).toContain("'invoices.issued'")
    // Closed period guard
    expect(rpcSql).toMatch(/billing period .* is closed/)
  })

  it('defines record_bulk_payments with row lock + structured failure details + bulk audit', () => {
    expect(rpcSql).toMatch(/CREATE OR REPLACE FUNCTION public\.record_bulk_payments/)
    expect(rpcSql).toMatch(/RETURNS SETOF public\.invoice_payments/)
    // Row-level lock to make read-modify-write race-free
    expect(rpcSql).toMatch(/FROM public\.invoices[\s\S]*FOR UPDATE/)
    // Structured exceptions carry failed_index / failed_reason so the service
    // can map back to the CONFLICT envelope.
    expect(rpcSql).toContain("'failed_index'")
    expect(rpcSql).toContain("'failed_reason'")
    expect(rpcSql).toMatch(/ERRCODE\s*=\s*'P0001'/)
    // Period transition + single bulk audit
    expect(rpcSql).toContain("'period.status_changed'")
    expect(rpcSql).toContain("'payments.bulk_recorded'")
    // Overpayment, void, closed-period guards
    expect(rpcSql).toMatch(/amount % exceeds balance/)
    expect(rpcSql).toMatch(/invoice .* is void/)
    expect(rpcSql).toMatch(/period of invoice .* is closed/)
  })

  it('grants execute on both functions to authenticated', () => {
    expect(rpcSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.issue_period_invoices.*TO authenticated/)
    expect(rpcSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.record_bulk_payments.*TO authenticated/)
  })
})

const issueAndPaySql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260630140000_issue_and_pay_rpc.sql'),
  'utf8',
)

describe('issue_and_pay transaction RPC SQL', () => {
  it('defines issue_and_pay with advisory lock + period FOR UPDATE returning invoices', () => {
    expect(issueAndPaySql).toMatch(/CREATE OR REPLACE FUNCTION public\.issue_and_pay/)
    expect(issueAndPaySql).toMatch(/RETURNS SETOF public\.invoices/)
    expect(issueAndPaySql).toMatch(/pg_advisory_xact_lock\s*\(\s*hashtextextended/)
    expect(issueAndPaySql).toMatch(/FROM public\.billing_periods[\s\S]*FOR UPDATE/)
  })

  it('carries structured error codes for the closed / already-issued / not-ready guards', () => {
    expect(issueAndPaySql).toContain("'PERIOD_LOCKED'")
    expect(issueAndPaySql).toContain("'ALREADY_ISSUED'")
    expect(issueAndPaySql).toContain("'DRAFT_NOT_READY'")
    expect(issueAndPaySql).toMatch(/ERRCODE\s*=\s*'P0002'/)
  })

  it('emits issued + payment audit events and grants execute to authenticated', () => {
    expect(issueAndPaySql).toContain("'invoices.issued'")
    expect(issueAndPaySql).toContain("'invoice.payment_recorded'")
    expect(issueAndPaySql).toMatch(/GRANT EXECUTE ON FUNCTION public\.issue_and_pay[\s\S]*TO authenticated/)
  })
})
