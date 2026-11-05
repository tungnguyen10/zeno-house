// Read-only reserve accrual reconciliation (ZH-BIL-01 PR3a). It never writes to the database.
// Usage: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/reconcile-reserve-accruals.mjs [--out report.csv]
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { computeAccrualFormula } from '../server/utils/billing/accrual-formula.ts'

export const RECONCILIATION_COLUMNS = [
  'building_code',
  'building_name',
  'period',
  'billing_period_id',
  'operations_report_status',
  'stored_amount',
  'recomputed_amount',
  'difference',
  'stored_rate_percent',
  'effective_rate_percent',
  'status',
]

export function buildReconciliationRow({
  building,
  period,
  reportStatus,
  storedAmount,
  storedRatePercent,
  recomputedAmount,
  effectiveRatePercent,
}) {
  const hasStored = storedAmount !== null && storedAmount !== undefined
  let status = 'missing_accrual'
  if (hasStored) status = storedAmount === recomputedAmount ? 'match' : 'mismatch'
  return {
    building_code: building.code,
    building_name: building.name,
    period: `${period.periodYear}-${String(period.periodMonth).padStart(2, '0')}`,
    billing_period_id: period.id,
    operations_report_status: reportStatus,
    stored_amount: hasStored ? storedAmount : '',
    recomputed_amount: recomputedAmount,
    difference: hasStored ? recomputedAmount - storedAmount : '',
    stored_rate_percent: hasStored && storedRatePercent != null ? storedRatePercent : '',
    effective_rate_percent: effectiveRatePercent,
    status,
  }
}

function escapeCsv(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function reconciliationToCsv(rows) {
  const lines = [RECONCILIATION_COLUMNS.join(',')]
  for (const row of rows) {
    lines.push(RECONCILIATION_COLUMNS.map(column => escapeCsv(row[column])).join(','))
  }
  return `${lines.join('\n')}\n`
}

function mapSnapshotToFormulaInput(snapshot, periodYear, periodMonth) {
  return {
    periodYear,
    periodMonth,
    invoiceTotals: (snapshot.invoices ?? []).map(invoice => Number(invoice.total_amount)),
    fixedCosts: (snapshot.fixed_costs ?? []).map(cost => ({
      amount: Number(cost.amount),
      effectiveFromPeriodYear: cost.effective_from_period_year,
      effectiveFromPeriodMonth: cost.effective_from_period_month,
      effectiveToPeriodYear: cost.effective_to_period_year,
      effectiveToPeriodMonth: cost.effective_to_period_month,
    })),
    expenses: (snapshot.expenses ?? []).map(expense => ({
      amount: Number(expense.amount),
      fundedBy: expense.funded_by ?? 'direct',
    })),
    prepaidMonthlyAmounts: (snapshot.prepaid_items ?? []).map(item => Number(item.monthly_amount)),
    reserveRatePercent: Number(snapshot.reserve_rate?.reserve_rate_percent ?? 0),
  }
}

export async function reconcile(client) {
  const { data: periods, error } = await client
    .from('billing_periods')
    .select('id, building_id, period_year, period_month, buildings(code, name)')
    .eq('status', 'closed')
    .order('period_year', { ascending: true })
    .order('period_month', { ascending: true })
  if (error) throw new Error(`Failed to read closed billing periods: ${error.message}`)

  const rows = []
  for (const period of periods ?? []) {
    const { data: snapshot, error: snapshotError } = await client.rpc('operations_report_snapshot', {
      p_building_id: period.building_id,
      p_period_year: period.period_year,
      p_period_month: period.period_month,
    })
    if (snapshotError) {
      throw new Error(`Snapshot failed for ${period.building_id} ${period.period_year}-${period.period_month}: ${snapshotError.message}`)
    }
    const result = computeAccrualFormula(
      mapSnapshotToFormulaInput(snapshot, period.period_year, period.period_month),
    )
    const stored = (snapshot.reserve_transactions ?? []).find(tx =>
      tx.source === 'monthly_accrual'
      && tx.period_year === period.period_year
      && tx.period_month === period.period_month
      && !tx.voided_at,
    )
    const building = Array.isArray(period.buildings) ? period.buildings[0] : period.buildings
    rows.push(buildReconciliationRow({
      building: { code: building?.code ?? '', name: building?.name ?? '' },
      period: { id: period.id, periodYear: period.period_year, periodMonth: period.period_month },
      reportStatus: snapshot.closure?.status ?? 'open',
      storedAmount: stored ? Number(stored.amount) : null,
      storedRatePercent: stored?.reserve_rate_percent != null ? Number(stored.reserve_rate_percent) : null,
      recomputedAmount: result.accrualAmount,
      effectiveRatePercent: result.reserveRatePercent,
    }))
  }
  return rows
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.')
    process.exit(1)
  }
  const outIndex = process.argv.indexOf('--out')
  const outFile = outIndex >= 0 ? process.argv[outIndex + 1] : null

  const client = createClient(url, key, { auth: { persistSession: false } })
  reconcile(client)
    .then((rows) => {
      const csv = reconciliationToCsv(rows)
      if (outFile) {
        writeFileSync(outFile, csv)
        const mismatches = rows.filter(row => row.status !== 'match').length
        process.stdout.write(`Wrote ${rows.length} rows to ${outFile} (${mismatches} not matching).\n`)
      }
      else {
        process.stdout.write(csv)
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'Reconciliation failed.')
      process.exitCode = 1
    })
}
