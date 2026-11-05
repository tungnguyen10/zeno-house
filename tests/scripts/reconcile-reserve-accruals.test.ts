import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  RECONCILIATION_COLUMNS,
  buildReconciliationRow,
  reconciliationToCsv,
} from '../../scripts/reconcile-reserve-accruals.mjs'

const scriptSource = readFileSync(
  resolve(__dirname, '../../scripts/reconcile-reserve-accruals.mjs'),
  'utf8',
)

const baseArgs = {
  building: { code: 'B1', name: 'Building 1' },
  period: { id: 'period-1', periodYear: 2026, periodMonth: 10 },
  reportStatus: 'closed',
  storedAmount: 100,
  storedRatePercent: 10,
  recomputedAmount: 100,
  effectiveRatePercent: 10,
}

describe('buildReconciliationRow', () => {
  it('marks equal amounts as a match', () => {
    const row = buildReconciliationRow(baseArgs)
    expect(row.status).toBe('match')
    expect(row.difference).toBe(0)
    expect(row.period).toBe('2026-10')
    expect(row.billing_period_id).toBe('period-1')
  })

  it('reports recomputed minus stored as the difference on a mismatch', () => {
    const row = buildReconciliationRow({ ...baseArgs, storedAmount: 110 })
    expect(row.status).toBe('mismatch')
    expect(row.difference).toBe(-10)
  })

  it('flags a missing accrual and leaves stored columns empty', () => {
    const row = buildReconciliationRow({ ...baseArgs, storedAmount: null, storedRatePercent: null })
    expect(row.status).toBe('missing_accrual')
    expect(row.stored_amount).toBe('')
    expect(row.stored_rate_percent).toBe('')
    expect(row.difference).toBe('')
  })
})

describe('reconciliationToCsv', () => {
  it('writes the header and escapes commas and quotes', () => {
    const row = buildReconciliationRow({
      ...baseArgs,
      building: { code: 'B1', name: 'Nha "A", khu 1' },
    })
    const lines = reconciliationToCsv([row]).trim().split('\n')
    expect(lines[0]).toBe(RECONCILIATION_COLUMNS.join(','))
    expect(lines[1]).toContain('"Nha ""A"", khu 1"')
  })
})

describe('reconcile-reserve-accruals.mjs source', () => {
  it('never writes to the database', () => {
    expect(scriptSource).not.toMatch(/\.(insert|update|upsert|delete)\(/)
  })

  it('only calls the operations_report_snapshot RPC', () => {
    const targets = [...scriptSource.matchAll(/\.rpc\(\s*'([^']+)'/g)].map(match => match[1])
    expect(targets).toEqual(['operations_report_snapshot'])
  })
})
