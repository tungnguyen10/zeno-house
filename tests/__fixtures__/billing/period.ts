import type { BillingPeriod } from '~/types/billing'

export function buildPeriod(overrides: Partial<BillingPeriod> = {}): BillingPeriod {
  return {
    id: 'period-2026-05',
    buildingId: 'building-1',
    periodYear: 2026,
    periodMonth: 5,
    status: 'draft',
    openedBy: 'user-1',
    issuedAt: null,
    closedAt: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  }
}
