import type { CheckoutBundle, CheckoutPreview } from '~/types/checkout'
import { calculateCheckoutTotals } from '~/utils/checkout'

export function mapCheckoutPreview(value: unknown): CheckoutPreview {
  const row = value as CheckoutPreview
  if (!row || !Array.isArray(row.charges) || !Array.isArray(row.invoices) || !Array.isArray(row.blockers)) {
    throw new Error('Invalid checkout preview response')
  }
  // Narrow to the four ledger inputs only — the full row also carries arrays/strings
  // (charges, invoices, snapshotHash, ...) that would fail the integer check below.
  const totals = calculateCheckoutTotals({
    depositHeld: row.depositHeld,
    creditHeld: row.creditHeld,
    existingDebt: row.existingDebt,
    finalChargesTotal: row.finalChargesTotal,
  })
  for (const key of ['totalDue', 'creditApplied', 'depositApplied', 'refundDue', 'additionalDue'] as const) {
    if (row[key] !== totals[key]) throw new Error(`Inconsistent checkout total: ${key}`)
  }
  if (row.charges.reduce((sum, line) => sum + line.amount, 0) !== row.finalChargesTotal) {
    throw new Error('Inconsistent checkout charge total')
  }
  return row
}

export function mapCheckoutBundle(value: unknown): Omit<CheckoutBundle, 'enabled'> {
  const row = value as Omit<CheckoutBundle, 'enabled'>
  if (!row || !Array.isArray(row.refunds) || !Array.isArray(row.sources)
    || !Number.isSafeInteger(row.depositHeld) || row.depositHeld < 0
    || !Number.isSafeInteger(row.creditHeld) || row.creditHeld < 0) {
    throw new Error('Invalid checkout response')
  }
  if (row.statement) mapCheckoutPreview(row.statement.preview)
  return row
}
