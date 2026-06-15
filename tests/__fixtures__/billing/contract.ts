import type { Contract } from '~/types/contracts'
import type { DraftRuleContract, UtilityRuleConfig } from '~/server/services/billing/rules'

export function buildContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'contract-1',
    contractCode: 'hd-2026-0001',
    roomId: 'room-1',
    tenantId: 'tenant-1',
    buildingId: 'building-1',
    startDate: '2026-05-01',
    endDate: '2027-05-01',
    monthlyRent: 3_100_000,
    deposit: 3_100_000,
    paymentDay: 5,
    occupantCount: 2,
    discountAmount: 0,
    surchargeAmount: 0,
    previousContractId: null,
    originalEndDate: null,
    renewalCount: 0,
    status: 'active',
    notes: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  }
}

export function buildDraftContract(overrides: Partial<DraftRuleContract> = {}): DraftRuleContract {
  const contract = buildContract()
  return {
    id: contract.id,
    roomId: contract.roomId,
    monthlyRent: contract.monthlyRent,
    occupantCount: contract.occupantCount,
    discountAmount: contract.discountAmount,
    surchargeAmount: contract.surchargeAmount,
    startDate: contract.startDate,
    endDate: contract.endDate,
    ...overrides,
  }
}

export function buildContractCharges(overrides: {
  rent?: number
  discount?: number
  electricity?: Partial<UtilityRuleConfig>
  water?: Partial<UtilityRuleConfig>
} = {}) {
  return {
    rent: overrides.rent ?? 3_100_000,
    discount: overrides.discount ?? 0,
    electricity: {
      meterType: 'electricity',
      pricingType: 'per_kwh',
      rate: 4_000,
      ...overrides.electricity,
    } satisfies UtilityRuleConfig,
    water: {
      meterType: 'water',
      pricingType: 'per_m3',
      rate: 15_000,
      ...overrides.water,
    } satisfies UtilityRuleConfig,
  }
}
