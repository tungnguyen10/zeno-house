import type { BuildingReadiness, ReadinessCode } from '~/types/building-contract-profile'
import { READINESS_LABELS } from '~/utils/constants/readiness'
import { formatCurrency } from '~/utils/format/currency'

export type SetupStepId = 'lessor-profile' | 'contract-terms' | 'basics' | 'invoice-profile' | 'service-defaults' | 'inventory-template'
export type SetupStepStatus = 'ready' | 'missing' | 'warning' | 'optional'

export interface SetupStep {
  id: SetupStepId
  label: string
  summary: string
  status: SetupStepStatus
  missingCount: number
  /** Required steps count toward "ready to create a contract". */
  required: boolean
  /** Visible in progress but not openable by this user. */
  locked: boolean
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
    lessorPhone: string | null
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

const REQUIRED_ORDER: SetupStepId[] = ['lessor-profile', 'contract-terms', 'basics', 'invoice-profile']
const STEP_LABELS: Record<SetupStepId, string> = {
  'lessor-profile': 'Bên cho thuê',
  'contract-terms': 'Điều khoản hợp đồng',
  'basics': 'Thông tin và lịch vận hành',
  'invoice-profile': 'Thanh toán trên hóa đơn',
  'service-defaults': 'Dịch vụ mặc định',
  'inventory-template': 'Nội thất mẫu',
}

function missingCodes(readiness: BuildingReadiness): ReadinessCode[] {
  return [...new Set([...readiness.contract.missing, ...readiness.billing.missing])]
}

function listMissing(codes: ReadinessCode[]): string {
  const labels = codes.map(code => READINESS_LABELS[code]?.label ?? code)
  const shown = labels.slice(0, MAX_LISTED_MISSING).join(', ')
  return labels.length > MAX_LISTED_MISSING ? `Thiếu: ${shown}…` : `Thiếu: ${shown}`
}

export function stepForCode(code: ReadinessCode): SetupStepId {
  if (code.startsWith('lessor.')) return 'lessor-profile'
  if (code.startsWith('contract.') || code.startsWith('terms.')) return 'contract-terms'
  if (code === 'invoice_profile') return 'invoice-profile'
  return 'basics'
}

function codesFor(codes: ReadinessCode[], id: SetupStepId): ReadinessCode[] {
  return codes.filter(code => stepForCode(code) === id)
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

function lessorSummary(input: SetupStepsInput, missing: ReadinessCode[]): string {
  if (!input.canViewContractProfile) return 'Cần chủ tòa hoàn tất'
  if (missing.length > 0) return listMissing(missing)
  const profile = input.contractProfile
  return [profile?.lessorFullName, profile?.lessorPhone].filter(Boolean).join(' · ') || 'Đã thiết lập'
}

function termsSummary(input: SetupStepsInput, missing: ReadinessCode[]): string {
  if (!input.canViewContractProfile) return 'Cần chủ tòa hoàn tất'
  if (missing.length > 0) return `Thiếu ${missing.length} mục`
  const profile = input.contractProfile
  const parts: string[] = []
  if (profile?.defaultTermMonths != null) parts.push(`${profile.defaultTermMonths} tháng`)
  if (profile?.defaultDepositMonths != null) parts.push(`Cọc ${profile.defaultDepositMonths} tháng`)
  return parts.join(' · ') || 'Đã thiết lập'
}

function requiredStep(id: SetupStepId, missing: ReadinessCode[], summary: string, locked: boolean): SetupStep {
  return {
    id, label: STEP_LABELS[id], summary, locked, required: true,
    status: missing.length > 0 ? 'missing' : 'ready',
    missingCount: missing.length,
  }
}

export function deriveSetupSteps(input: SetupStepsInput): SetupFlow {
  const codes = missingCodes(input.readiness)
  const contractLocked = !input.canViewContractProfile
  const steps: SetupStep[] = [
    requiredStep('lessor-profile', codesFor(codes, 'lessor-profile'), lessorSummary(input, codesFor(codes, 'lessor-profile')), contractLocked),
    requiredStep('contract-terms', codesFor(codes, 'contract-terms'), termsSummary(input, codesFor(codes, 'contract-terms')), contractLocked),
    requiredStep('basics', codesFor(codes, 'basics'), basicsSummary(input, codesFor(codes, 'basics')), false),
    {
      ...requiredStep('invoice-profile', codesFor(codes, 'invoice-profile'), '', false),
      summary: codesFor(codes, 'invoice-profile').length > 0 ? 'Chưa cấu hình' : 'Đã cấu hình nhận diện và tài khoản nhận tiền',
    },
  ]

  const { activeCount, unpricedActiveCount } = input.services
  steps.push({
    id: 'service-defaults',
    label: STEP_LABELS['service-defaults'],
    summary: activeCount === 0
      ? 'Chưa bật dịch vụ nào'
      : unpricedActiveCount > 0
        ? `${activeCount} dịch vụ bật · ${unpricedActiveCount} chưa đặt giá`
        : `${activeCount} dịch vụ bật`,
    status: activeCount === 0 ? 'optional' : unpricedActiveCount > 0 ? 'warning' : 'ready',
    missingCount: unpricedActiveCount,
    required: false,
    locked: false,
  })

  if (input.canViewInventory) {
    const { itemCount, totalValue } = input.inventory
    steps.push({
      id: 'inventory-template',
      label: STEP_LABELS['inventory-template'],
      summary: itemCount === 0 ? 'Chưa có nội thất mẫu' : `${itemCount} món · ${formatCurrency(totalValue)}`,
      status: itemCount === 0 ? 'optional' : 'ready',
      missingCount: 0,
      required: false,
      locked: false,
    })
  }

  const required = steps.filter(step => step.required)
  const requiredReady = required.filter(step => step.status === 'ready').length
  const next = required.find(step => step.status === 'missing' && !step.locked)

  return {
    steps,
    requiredTotal: required.length,
    requiredReady,
    ready: requiredReady === required.length,
    nextStepId: next?.id ?? null,
  }
}

export function nextSetupStepId(flow: SetupFlow, currentId: SetupStepId | null): SetupStepId | null {
  const open = flow.steps.filter(step => !step.locked)
  const missingRequired = open.find(step => step.required && step.status === 'missing' && step.id !== currentId)
  if (missingRequired) return missingRequired.id
  if (currentId === null) return null
  const current = open.find(step => step.id === currentId)
  if (current?.required && current.status === 'missing') return current.id
  const index = open.findIndex(step => step.id === currentId)
  // A current step that is locked or hidden is not in `open`; there is nothing after it to advance to.
  return open.slice(index === -1 ? open.length : index + 1).find(step => !step.required)?.id ?? null
}

const STEP_HASH_ALIASES: Record<string, SetupStepId> = { 'contract-profile': 'lessor-profile' }

export function resolveStepHash(hash: string): string {
  return STEP_HASH_ALIASES[hash] ?? hash
}

export function summarizeRequiredSteps(readiness: BuildingReadiness): {
  requiredTotal: number
  requiredReady: number
  ready: boolean
  missingLabels: string[]
  nextStepId: SetupStepId | null
} {
  const codes = missingCodes(readiness)
  const missingSteps = REQUIRED_ORDER.filter(id => codesFor(codes, id).length > 0)
  return {
    requiredTotal: REQUIRED_ORDER.length,
    requiredReady: REQUIRED_ORDER.length - missingSteps.length,
    ready: missingSteps.length === 0,
    missingLabels: missingSteps.map(id => STEP_LABELS[id]),
    nextStepId: missingSteps[0] ?? null,
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
  /** Visible in progress but not openable by this user. */
  locked?: boolean
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
