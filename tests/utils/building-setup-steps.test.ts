import { describe, expect, it } from 'vitest'
import { countActiveFinanceRules, deriveAdvancedSteps, deriveSetupSteps, nextSetupStepId, resolveStepHash, summarizeRequiredSteps, type SetupStepsInput } from '~/utils/building-setup-steps'
import { READINESS_LABELS } from '~/utils/constants/readiness'

const ready = { ready: true, missing: [] }

function input(overrides: Partial<SetupStepsInput> = {}): SetupStepsInput {
  return {
    readiness: { contract: ready, billing: ready },
    building: { defaultElectricityRate: 3500, defaultWaterRate: 15000, billingGenerationDay: 1, paymentDueDay: 5 },
    contractProfile: { lessorFullName: 'Nguyen Van QA', lessorPhone: '0901234567', defaultTermMonths: 12, defaultDepositMonths: 1 },
    services: { activeCount: 3, unpricedActiveCount: 0 },
    inventory: { itemCount: 4, totalValue: 7_200_000 },
    canViewContractProfile: true,
    canViewInventory: true,
    ...overrides,
  }
}

const newBuilding = () => input({
  readiness: {
    contract: { ready: false, missing: ['lessor.full_name', 'contract.default_term_months', 'terms.notice_days', 'billing.schedule', 'invoice_profile'] },
    billing: { ready: false, missing: ['billing.schedule', 'billing.electricity_rate', 'invoice_profile'] },
  },
  building: { defaultElectricityRate: null, defaultWaterRate: null, billingGenerationDay: null, paymentDueDay: null },
  contractProfile: null,
  services: { activeCount: 0, unpricedActiveCount: 0 },
  inventory: { itemCount: 0, totalValue: 0 },
})

const byId = (flow: ReturnType<typeof deriveSetupSteps>, id: string) => flow.steps.find(s => s.id === id)

describe('deriveSetupSteps', () => {
  it('lists six steps in setup order with four required', () => {
    const flow = deriveSetupSteps(input())
    expect(flow.steps.map(s => s.id)).toEqual([
      'lessor-profile', 'contract-terms', 'basics', 'invoice-profile', 'service-defaults', 'inventory-template',
    ])
    expect(flow.steps.filter(s => s.required).map(s => s.id)).toEqual(['lessor-profile', 'contract-terms', 'basics', 'invoice-profile'])
    expect(flow).toMatchObject({ ready: true, requiredTotal: 4, requiredReady: 4, nextStepId: null })
  })

  it('splits lessor and contract codes into their own steps', () => {
    const flow = deriveSetupSteps(newBuilding())
    expect(byId(flow, 'lessor-profile')).toMatchObject({ status: 'missing', missingCount: 1 })
    expect(byId(flow, 'contract-terms')).toMatchObject({ status: 'missing', missingCount: 2 })
    expect(byId(flow, 'basics')).toMatchObject({ status: 'missing', missingCount: 2 })
    expect(flow.nextStepId).toBe('lessor-profile')
  })

  it('summarizes the lessor step with name and phone', () => {
    expect(byId(deriveSetupSteps(input()), 'lessor-profile')!.summary).toBe('Nguyen Van QA · 0901234567')
  })

  it('keeps a contract step the user cannot view as locked and still required', () => {
    const flow = deriveSetupSteps({ ...newBuilding(), canViewContractProfile: false })
    expect(byId(flow, 'lessor-profile')).toMatchObject({ locked: true, required: true })
    expect(byId(flow, 'contract-terms')).toMatchObject({ locked: true, required: true })
    expect(flow.requiredTotal).toBe(4)
    expect(flow.nextStepId).toBe('basics')
  })

  it('hides the inventory step without rooms.read', () => {
    expect(deriveSetupSteps(input({ canViewInventory: false })).steps.map(s => s.id)).not.toContain('inventory-template')
  })
})

describe('nextSetupStepId', () => {
  it('prefers the next missing required step after saving the current one', () => {
    const flow = deriveSetupSteps(newBuilding())
    expect(nextSetupStepId(flow, 'lessor-profile')).toBe('contract-terms')
  })

  it('goes to the next optional step in order once required steps are done', () => {
    const flow = deriveSetupSteps(input({ services: { activeCount: 0, unpricedActiveCount: 0 } }))
    expect(nextSetupStepId(flow, 'invoice-profile')).toBe('service-defaults')
    expect(nextSetupStepId(flow, 'service-defaults')).toBe('inventory-template')
  })

  it('returns null after the last step and when everything is done', () => {
    const flow = deriveSetupSteps(input())
    expect(nextSetupStepId(flow, 'inventory-template')).toBeNull()
    expect(nextSetupStepId(flow, null)).toBeNull()
  })

  it('skips locked steps', () => {
    const flow = deriveSetupSteps({ ...newBuilding(), canViewContractProfile: false })
    expect(nextSetupStepId(flow, null)).toBe('basics')
  })

  it('returns null instead of restarting when the current step is locked or hidden', () => {
    const locked = deriveSetupSteps(input({ canViewContractProfile: false }))
    expect(nextSetupStepId(locked, 'lessor-profile')).toBeNull()
    const hidden = deriveSetupSteps(input({ canViewInventory: false }))
    expect(nextSetupStepId(hidden, 'inventory-template')).toBeNull()
  })
})

describe('resolveStepHash', () => {
  it('maps the old contract-profile hash to lessor-profile and keeps others', () => {
    expect(resolveStepHash('contract-profile')).toBe('lessor-profile')
    expect(resolveStepHash('basics')).toBe('basics')
  })
})

describe('summarizeRequiredSteps', () => {
  it('counts four required steps from readiness alone', () => {
    const summary = summarizeRequiredSteps(newBuilding().readiness)
    expect(summary).toMatchObject({ requiredTotal: 4, requiredReady: 0, ready: false, nextStepId: 'lessor-profile' })
    expect(summary.missingLabels[0]).toBe('Bên cho thuê')
  })

  it('is ready when nothing is missing', () => {
    expect(summarizeRequiredSteps({ contract: ready, billing: ready })).toMatchObject({ requiredReady: 4, ready: true, nextStepId: null })
  })
})

describe('READINESS_LABELS anchors', () => {
  it('points every code at a real step id', () => {
    expect(READINESS_LABELS['lessor.full_name'].anchor).toBe('lessor-profile')
    expect(READINESS_LABELS['contract.default_term_months'].anchor).toBe('contract-terms')
    expect(READINESS_LABELS['terms.notice_days'].anchor).toBe('contract-terms')
    expect(READINESS_LABELS['billing.schedule'].anchor).toBe('basics')
    expect(READINESS_LABELS.invoice_profile.anchor).toBe('invoice-profile')
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
