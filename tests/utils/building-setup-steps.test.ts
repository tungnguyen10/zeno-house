import { describe, expect, it } from 'vitest'
import { countActiveFinanceRules, deriveAdvancedSteps, deriveSetupSteps, type SetupStepsInput } from '~/utils/building-setup-steps'

const ready = { ready: true, missing: [] }

function input(overrides: Partial<SetupStepsInput> = {}): SetupStepsInput {
  return {
    readiness: { contract: ready, billing: ready },
    building: { defaultElectricityRate: 3500, defaultWaterRate: 15000, billingGenerationDay: 1, paymentDueDay: 5 },
    contractProfile: { lessorFullName: 'Nguyen Van QA', defaultTermMonths: 12, defaultDepositMonths: 1 },
    services: { activeCount: 3, unpricedActiveCount: 0 },
    inventory: { itemCount: 4, totalValue: 7_200_000 },
    canViewContractProfile: true,
    canViewInventory: true,
    ...overrides,
  }
}

const byId = (flow: ReturnType<typeof deriveSetupSteps>, id: string) => flow.steps.find(s => s.id === id)

describe('deriveSetupSteps', () => {
  it('lists steps in setup order', () => {
    const flow = deriveSetupSteps(input())
    expect(flow.steps.map(s => s.id)).toEqual([
      'basics', 'invoice-profile', 'service-defaults', 'inventory-template', 'contract-profile',
    ])
  })

  it('marks everything ready and has no next step', () => {
    const flow = deriveSetupSteps(input())
    expect(flow.ready).toBe(true)
    expect(flow.requiredReady).toBe(3)
    expect(flow.requiredTotal).toBe(3)
    expect(flow.nextStepId).toBeNull()
    expect(byId(flow, 'contract-profile')!.summary).toContain('Nguyen Van QA')
    expect(byId(flow, 'contract-profile')!.summary).toContain('Cọc 1 tháng')
  })

  it('reports a brand-new building with nothing configured', () => {
    const flow = deriveSetupSteps(input({
      readiness: {
        contract: { ready: false, missing: ['lessor.full_name', 'terms.notice_days', 'billing.schedule', 'invoice_profile'] },
        billing: { ready: false, missing: ['billing.schedule', 'billing.electricity_rate', 'billing.water_rate', 'invoice_profile'] },
      },
      building: { defaultElectricityRate: null, defaultWaterRate: null, billingGenerationDay: null, paymentDueDay: null },
      contractProfile: null,
      services: { activeCount: 0, unpricedActiveCount: 0 },
      inventory: { itemCount: 0, totalValue: 0 },
    }))

    expect(flow.ready).toBe(false)
    expect(flow.requiredReady).toBe(0)
    expect(byId(flow, 'basics')).toMatchObject({ status: 'missing', missingCount: 3 })
    expect(byId(flow, 'invoice-profile')).toMatchObject({ status: 'missing', missingCount: 1 })
    expect(byId(flow, 'contract-profile')).toMatchObject({ status: 'missing', missingCount: 2 })
    expect(byId(flow, 'contract-profile')!.summary).toBe('Thiếu 2 mục')
    expect(flow.nextStepId).toBe('basics')
  })

  it('does not double count shared codes across contract and billing', () => {
    const flow = deriveSetupSteps(input({
      readiness: {
        contract: { ready: false, missing: ['invoice_profile'] },
        billing: { ready: false, missing: ['invoice_profile'] },
      },
    }))
    expect(byId(flow, 'invoice-profile')!.missingCount).toBe(1)
    expect(flow.requiredReady).toBe(2)
    expect(flow.nextStepId).toBe('invoice-profile')
  })

  it('picks the first required missing step in flow order as next', () => {
    const flow = deriveSetupSteps(input({
      readiness: { contract: { ready: false, missing: ['terms.drilling_fee'] }, billing: ready },
    }))
    expect(flow.nextStepId).toBe('contract-profile')
  })

  it('hides contract and inventory steps from users without access and excludes them from progress', () => {
    const flow = deriveSetupSteps(input({ canViewContractProfile: false, canViewInventory: false }))
    expect(flow.steps.map(s => s.id)).toEqual(['basics', 'invoice-profile', 'service-defaults'])
    expect(flow.requiredTotal).toBe(2)
  })

  it('warns, without blocking readiness, when an active service has no price', () => {
    const flow = deriveSetupSteps(input({ services: { activeCount: 3, unpricedActiveCount: 1 } }))
    const services = byId(flow, 'service-defaults')!
    expect(services.status).toBe('warning')
    expect(services.summary).toContain('1 chưa đặt giá')
    expect(flow.ready).toBe(true)
  })

  it('treats empty services and inventory as optional', () => {
    const flow = deriveSetupSteps(input({
      services: { activeCount: 0, unpricedActiveCount: 0 },
      inventory: { itemCount: 0, totalValue: 0 },
    }))
    expect(byId(flow, 'service-defaults')).toMatchObject({ status: 'optional', required: false })
    expect(byId(flow, 'inventory-template')).toMatchObject({ status: 'optional', required: false })
    expect(flow.ready).toBe(true)
  })

  it('lists the missing basics fields in the summary', () => {
    const flow = deriveSetupSteps(input({
      readiness: {
        contract: ready,
        billing: { ready: false, missing: ['billing.electricity_rate', 'billing.water_rate'] },
      },
    }))
    const basics = byId(flow, 'basics')!
    expect(basics.status).toBe('missing')
    expect(basics.summary).toContain('Đơn giá điện')
    expect(basics.summary).toContain('Đơn giá nước')
  })

  it('handles a missing building without throwing', () => {
    const flow = deriveSetupSteps(input({ building: null }))
    expect(byId(flow, 'basics')!.summary).toBeTruthy()
  })
})

describe('deriveAdvancedSteps', () => {
  const base = { buildingCode: 'qav2', managerCount: 2, canViewFinanceRules: true, financeRuleCount: 3, contractCount: 4 }

  it('lists identity, finance and overrides for a user who can see everything', () => {
    const steps = deriveAdvancedSteps(base)

    expect(steps.map(s => s.id)).toEqual(['identity-access', 'finance-rules', 'service-overrides'])
    expect(steps[0]!.summary).toBe('Mã qav2 · 2 manager')
    expect(steps[1]!.summary).toBe('3 mục đang áp dụng')
    expect(steps[2]!.summary).toBe('4 hợp đồng active')
    expect(steps.every(s => s.statusLabel === 'Nâng cao' && s.status === 'optional')).toBe(true)
  })

  it('hides finance rules without permission and omits managers when not visible', () => {
    const steps = deriveAdvancedSteps({ ...base, canViewFinanceRules: false, managerCount: null })

    expect(steps.map(s => s.id)).toEqual(['identity-access', 'service-overrides'])
    expect(steps[0]!.summary).toBe('Mã qav2')
  })

  it('falls back when the building has no code yet', () => {
    expect(deriveAdvancedSteps({ ...base, buildingCode: null, managerCount: null })[0]!.summary).toBe('Mã tòa nhà')
  })
})

describe('countActiveFinanceRules', () => {
  it('counts only rules that are still in effect', () => {
    expect(countActiveFinanceRules({
      fixedCosts: [{ effectiveToPeriodYear: null }, { effectiveToPeriodYear: 2026 }],
      reserveRates: [{ effectiveToPeriodYear: null }],
      recurringExpenses: [{ isActive: true }, { isActive: false }],
      prepaidExpenses: [{ status: 'active' }, { status: 'completed' }],
    })).toBe(4)
  })

  it('returns 0 for empty settings', () => {
    expect(countActiveFinanceRules({ fixedCosts: [], reserveRates: [], recurringExpenses: [], prepaidExpenses: [] })).toBe(0)
  })
})
