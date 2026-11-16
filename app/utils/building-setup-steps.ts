import type { BuildingReadiness, ReadinessCode } from '~/types/building-contract-profile'
import { READINESS_LABELS } from '~/utils/constants/readiness'
import { formatCurrency } from '~/utils/format/currency'

export type SetupStepId = 'basics' | 'invoice-profile' | 'service-defaults' | 'inventory-template' | 'contract-profile'
export type SetupStepStatus = 'ready' | 'missing' | 'warning' | 'optional'

export interface SetupStep {
  id: SetupStepId
  label: string
  summary: string
  status: SetupStepStatus
  missingCount: number
  /** Required steps count toward "ready to create a contract". */
  required: boolean
}

export interface SetupStepsInput {
  readiness: BuildingReadiness
  building: {
    defaultElectricityRate: number | null
    defaultWaterRate: number | null
    billingGenerationDay: number | null
    paymentDueDay: number | null
  } | null
  contractProfile: {
    lessorFullName: string | null
    defaultTermMonths: number | null
    defaultDepositMonths: number | null
  } | null
  services: { activeCount: number; unpricedActiveCount: number }
  inventory: { itemCount: number; totalValue: number }
  canViewContractProfile: boolean
  canViewInventory: boolean
}

export interface SetupFlow {
  steps: SetupStep[]
  requiredTotal: number
  requiredReady: number
  ready: boolean
  nextStepId: SetupStepId | null
}

const MAX_LISTED_MISSING = 2

function missingCodes(readiness: BuildingReadiness): ReadinessCode[] {
  return [...new Set([...readiness.contract.missing, ...readiness.billing.missing])]
}

function listMissing(codes: ReadinessCode[]): string {
  const labels = codes.map(code => READINESS_LABELS[code]?.label ?? code)
  const shown = labels.slice(0, MAX_LISTED_MISSING).join(', ')
  return labels.length > MAX_LISTED_MISSING ? `Thiếu: ${shown}…` : `Thiếu: ${shown}`
}

function basicsSummary(input: SetupStepsInput, missing: ReadinessCode[]): string {
  if (missing.length > 0) return listMissing(missing)
  const building = input.building
  if (!building) return 'Chưa có thông tin tòa nhà'
  const parts: string[] = []
  if (building.defaultElectricityRate != null) parts.push(`Điện ${formatCurrency(building.defaultElectricityRate)}`)
  if (building.defaultWaterRate != null) parts.push(`Nước ${formatCurrency(building.defaultWaterRate)}`)
  if (building.paymentDueDay != null) parts.push(`Hạn thanh toán ngày ${building.paymentDueDay}`)
  return parts.join(' · ') || 'Đã thiết lập'
}

function contractSummary(input: SetupStepsInput, missing: ReadinessCode[]): string {
  if (missing.length > 0) return `Thiếu ${missing.length} mục`
  const profile = input.contractProfile
  const parts: string[] = []
  if (profile?.lessorFullName) parts.push(profile.lessorFullName)
  if (profile?.defaultDepositMonths != null) parts.push(`Cọc ${profile.defaultDepositMonths} tháng`)
  if (profile?.defaultTermMonths != null) parts.push(`${profile.defaultTermMonths} tháng`)
  return parts.join(' · ') || 'Đã thiết lập'
}

export function deriveSetupSteps(input: SetupStepsInput): SetupFlow {
  const codes = missingCodes(input.readiness)
  const basicsMissing = codes.filter(code => code.startsWith('billing.'))
  const invoiceMissing = codes.filter(code => code === 'invoice_profile')
  const contractMissing = codes.filter(code => /^(lessor|contract|terms)\./.test(code))

  const steps: SetupStep[] = [
    {
      id: 'basics',
      label: 'Thông tin và lịch vận hành',
      summary: basicsSummary(input, basicsMissing),
      status: basicsMissing.length > 0 ? 'missing' : 'ready',
      missingCount: basicsMissing.length,
      required: true,
    },
    {
      id: 'invoice-profile',
      label: 'Thanh toán trên hóa đơn',
      summary: invoiceMissing.length > 0 ? 'Chưa cấu hình' : 'Đã cấu hình nhận diện và tài khoản nhận tiền',
      status: invoiceMissing.length > 0 ? 'missing' : 'ready',
      missingCount: invoiceMissing.length,
      required: true,
    },
  ]

  const { activeCount, unpricedActiveCount } = input.services
  steps.push({
    id: 'service-defaults',
    label: 'Dịch vụ mặc định',
    summary: activeCount === 0
      ? 'Chưa bật dịch vụ nào'
      : unpricedActiveCount > 0
        ? `${activeCount} dịch vụ bật · ${unpricedActiveCount} chưa đặt giá`
        : `${activeCount} dịch vụ bật`,
    status: activeCount === 0 ? 'optional' : unpricedActiveCount > 0 ? 'warning' : 'ready',
    missingCount: unpricedActiveCount,
    required: false,
  })

  if (input.canViewInventory) {
    const { itemCount, totalValue } = input.inventory
    steps.push({
      id: 'inventory-template',
      label: 'Nội thất mẫu',
      summary: itemCount === 0 ? 'Chưa có nội thất mẫu' : `${itemCount} món · ${formatCurrency(totalValue)}`,
      status: itemCount === 0 ? 'optional' : 'ready',
      missingCount: 0,
      required: false,
    })
  }

  if (input.canViewContractProfile) {
    steps.push({
      id: 'contract-profile',
      label: 'Hợp đồng',
      summary: contractSummary(input, contractMissing),
      status: contractMissing.length > 0 ? 'missing' : 'ready',
      missingCount: contractMissing.length,
      required: true,
    })
  }

  const required = steps.filter(step => step.required)
  const requiredReady = required.filter(step => step.status === 'ready').length
  const next = required.find(step => step.status === 'missing')

  return {
    steps,
    requiredTotal: required.length,
    requiredReady,
    ready: requiredReady === required.length,
    nextStepId: next?.id ?? null,
  }
}

/** Row shape shared by the setup step list and the advanced groups. */
export interface StepListItem {
  id: string
  label: string
  summary: string
  status: SetupStepStatus
  missingCount: number
  /** Overrides the default status text, e.g. for non-step groups. */
  statusLabel?: string
}

export interface AdvancedStepsInput {
  buildingCode: string | null
  managerCount: number | null
  canViewFinanceRules: boolean
  financeRuleCount: number
  contractCount: number
}

export function deriveAdvancedSteps(input: AdvancedStepsInput): StepListItem[] {
  const identity = [
    input.buildingCode ? `Mã ${input.buildingCode}` : null,
    input.managerCount != null ? `${input.managerCount} manager` : null,
  ].filter(Boolean).join(' · ')
  const group = { status: 'optional', missingCount: 0, statusLabel: 'Nâng cao' } as const

  const steps: StepListItem[] = [
    { ...group, id: 'identity-access', label: 'Mã tòa nhà và phân quyền', summary: identity || 'Mã tòa nhà' },
  ]
  if (input.canViewFinanceRules) {
    steps.push({ ...group, id: 'finance-rules', label: 'Quy tắc vận hành', summary: `${input.financeRuleCount} mục đang áp dụng` })
  }
  steps.push({ ...group, id: 'service-overrides', label: 'Dịch vụ theo hợp đồng', summary: `${input.contractCount} hợp đồng active` })
  return steps
}

export function countActiveFinanceRules(settings: {
  fixedCosts: { effectiveToPeriodYear?: number | null }[]
  reserveRates: { effectiveToPeriodYear?: number | null }[]
  recurringExpenses: { isActive: boolean }[]
  prepaidExpenses: { status: string }[]
}): number {
  return settings.fixedCosts.filter(item => !item.effectiveToPeriodYear).length
    + settings.reserveRates.filter(item => !item.effectiveToPeriodYear).length
    + settings.recurringExpenses.filter(item => item.isActive).length
    + settings.prepaidExpenses.filter(item => item.status === 'active').length
}
