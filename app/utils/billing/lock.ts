import type { BillingPeriod } from '~/types/billing'

/**
 * Single source of truth for "is this period locked from edits?".
 *
 * In the simplified workflow `closed` is the only lock: a closed period blocks
 * all reading edits, issuing, payments, voids, and adjustments until it is
 * explicitly reopened. Use this helper instead of comparing `status` strings
 * inline so the rule stays consistent across components.
 */
export function isPeriodLocked(period: Pick<BillingPeriod, 'status'> | null | undefined): boolean {
  return period?.status === 'closed'
}
