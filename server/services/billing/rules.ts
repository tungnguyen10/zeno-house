import type {
  BillingDraftBlocker,
  BillingDraftLine,
  BillingDraftWarning,
  BillingPeriod,
  Invoice,
} from '~/types/billing'
import {
  BILLING_BLOCKER_CODES,
  BILLING_WARNING_CODES,
} from '~/utils/constants/billing'
import { assertReason } from '../../utils/billing/reason'

export interface DraftRulePeriod {
  periodYear: number
  periodMonth: number
}

export interface DraftRuleContract {
  id: string
  roomId: string
  monthlyRent: number
  occupantCount: number
  discountAmount?: number
  surchargeAmount?: number
  startDate?: string
  endDate?: string | null
}

export type UtilityPricingType = 'per_kwh' | 'tiered' | 'fixed' | 'per_person' | 'per_m3' | 'fixed_per_room'

export interface TierBracket {
  upTo: number | null
  unitPrice: number
}

export interface UtilityRuleConfig {
  meterType: 'electricity' | 'water'
  pricingType: UtilityPricingType
  rate: number
  brackets?: TierBracket[]
}

export interface UtilityReadingRuleInput {
  current?: { id: string; value: number } | null
  previous?: { id: string; value: number } | null
  handover?: { id: string; value: number } | null
  override?: {
    id: string
    previousReadingId: string | null
    previousReadingValue: number
    currentReadingId: string | null
    currentReadingValue: number
    oldMeterFinalValue: number | null
    newMeterStartValue: number | null
    billableUsage: number
    reason: string
  } | null
}

export interface DraftRuleInput {
  period: DraftRulePeriod
  contract: DraftRuleContract
  electricity?: UtilityRuleConfig | null
  water?: UtilityRuleConfig | null
  readings?: {
    electricity?: UtilityReadingRuleInput
    water?: UtilityReadingRuleInput
  }
}

interface DraftRuleResult {
  lines: BillingDraftLine[]
  blockers: BillingDraftBlocker[]
  warnings: BillingDraftWarning[]
  subtotalAmount: number
  discountAmount: number
  surchargeAmount: number
  totalAmount: number
}

export function daysInPeriod(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function calculateProratedRent(input: {
  monthlyRent: number
  periodYear: number
  periodMonth: number
  startDate?: string
  endDate?: string | null
}): { amount: number; billableDays: number; periodDays: number } {
  const periodDays = daysInPeriod(input.periodYear, input.periodMonth)
  const periodStart = new Date(Date.UTC(input.periodYear, input.periodMonth - 1, 1))
  const periodEnd = new Date(Date.UTC(input.periodYear, input.periodMonth - 1, periodDays))
  const start = input.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : periodStart
  const end = input.endDate ? new Date(`${input.endDate}T00:00:00.000Z`) : periodEnd
  const effectiveStart = start > periodStart ? start : periodStart
  const effectiveEnd = end < periodEnd ? end : periodEnd
  if (effectiveEnd < effectiveStart) return { amount: 0, billableDays: 0, periodDays }
  const billableDays = Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / 86_400_000) + 1
  return {
    amount: Math.round(input.monthlyRent * billableDays / periodDays),
    billableDays,
    periodDays,
  }
}

export function calculateTieredAmount(usage: number, brackets: TierBracket[]): {
  amount: number
  breakdown: Array<{ from: number; to: number; quantity: number; unitPrice: number; amount: number }>
} {
  let remaining = usage
  let from = 0
  let total = 0
  const breakdown: Array<{ from: number; to: number; quantity: number; unitPrice: number; amount: number }> = []
  for (const bracket of brackets) {
    if (remaining <= 0) break
    const cap = bracket.upTo ?? Number.POSITIVE_INFINITY
    const quantity = Math.min(remaining, cap - from)
    if (quantity <= 0) {
      from = cap
      continue
    }
    const amount = Math.round(quantity * bracket.unitPrice)
    breakdown.push({ from, to: Number.isFinite(cap) ? cap : from + quantity, quantity, unitPrice: bracket.unitPrice, amount })
    total += amount
    remaining -= quantity
    from = cap
  }
  return { amount: total, breakdown }
}

function utilityLabel(meterType: 'electricity' | 'water', suffix = ''): string {
  const base = meterType === 'electricity' ? 'Tien dien' : 'Tien nuoc'
  return suffix ? `${base} (${suffix})` : base
}

function calculateUsage(input: UtilityReadingRuleInput): {
  usage: number | null
  source: 'monthly' | 'handover_fallback' | 'usage_override' | null
  previous: { id: string | null; value: number } | null
  current: { id: string | null; value: number } | null
  override: UtilityReadingRuleInput['override']
} {
  if (input.override) {
    return {
      usage: input.override.billableUsage,
      source: 'usage_override',
      previous: { id: input.override.previousReadingId, value: input.override.previousReadingValue },
      current: { id: input.override.currentReadingId, value: input.override.currentReadingValue },
      override: input.override,
    }
  }
  if (!input.current) return { usage: null, source: null, previous: null, current: null, override: null }
  const previous = input.previous ?? input.handover ?? null
  if (!previous) return { usage: null, source: null, previous: null, current: input.current, override: null }
  return {
    usage: input.current.value - previous.value,
    source: input.previous ? 'monthly' : 'handover_fallback',
    previous,
    current: input.current,
    override: null,
  }
}

export function calculateDraftRule(input: DraftRuleInput): DraftRuleResult {
  const lines: BillingDraftLine[] = []
  const blockers: BillingDraftBlocker[] = []
  const warnings: BillingDraftWarning[] = []
  const { contract, period } = input
  const rent = calculateProratedRent({
    monthlyRent: contract.monthlyRent,
    periodYear: period.periodYear,
    periodMonth: period.periodMonth,
    startDate: contract.startDate,
    endDate: contract.endDate,
  })

  lines.push({
    chargeType: 'rent',
    label: 'Tien phong',
    sourceType: 'contract',
    sourceId: contract.id,
    quantity: rent.billableDays / rent.periodDays,
    unitPrice: contract.monthlyRent,
    amount: rent.amount,
    metadata: { monthly_rent: contract.monthlyRent, billable_days: rent.billableDays, period_days: rent.periodDays },
    sortOrder: 0,
  })

  for (const [sortOrder, config, reading] of [
    [1, input.electricity, input.readings?.electricity],
    [2, input.water, input.readings?.water],
  ] as const) {
    if (!config) continue
    const meterType = config.meterType
    if (config.pricingType === 'fixed' || config.pricingType === 'fixed_per_room') {
      lines.push({
        chargeType: meterType,
        label: utilityLabel(meterType, 'co dinh'),
        sourceType: 'building',
        sourceId: null,
        quantity: 1,
        unitPrice: config.rate,
        amount: config.rate,
        metadata: { pricing_type: config.pricingType, rate: config.rate },
        sortOrder,
      })
      continue
    }
    if (config.pricingType === 'per_person') {
      const amount = Math.round(contract.occupantCount * config.rate)
      lines.push({
        chargeType: meterType,
        label: utilityLabel(meterType, 'theo nguoi'),
        sourceType: 'building',
        sourceId: null,
        quantity: contract.occupantCount,
        unitPrice: config.rate,
        amount,
        metadata: { pricing_type: 'per_person', rate: config.rate, occupant_count: contract.occupantCount },
        sortOrder,
      })
      continue
    }
    if (!reading?.current && !reading?.override) {
      blockers.push({
        code: BILLING_BLOCKER_CODES.MISSING_CURRENT_READING,
        message: meterType === 'electricity' ? 'Thieu chi so dien ky nay' : 'Thieu chi so nuoc ky nay',
        meta: { room_id: contract.roomId, meter_type: meterType },
      })
      continue
    }
    const usageResult = calculateUsage(reading)
    if (usageResult.usage === null || !usageResult.previous) {
      blockers.push({
        code: BILLING_BLOCKER_CODES.MISSING_PREVIOUS_READING,
        message: meterType === 'electricity' ? 'Thieu chi so dien ky truoc' : 'Thieu chi so nuoc ky truoc',
        meta: { room_id: contract.roomId, meter_type: meterType },
      })
      continue
    }
    if (usageResult.usage < 0) {
      blockers.push({
        code: BILLING_BLOCKER_CODES.NEGATIVE_CONSUMPTION,
        message: meterType === 'electricity' ? 'Chi so dien ky nay nho hon ky truoc' : 'Chi so nuoc ky nay nho hon ky truoc',
        meta: { room_id: contract.roomId, meter_type: meterType },
      })
      continue
    }
    if (usageResult.source === 'handover_fallback') {
      warnings.push({
        code: BILLING_WARNING_CODES.HANDOVER_FALLBACK_PREVIOUS,
        message: 'Su dung chi so ban giao lam chi so ky truoc',
        meta: { room_id: contract.roomId, meter_type: meterType },
      })
    }
    if (usageResult.source === 'usage_override') {
      warnings.push({
        code: BILLING_WARNING_CODES.USAGE_OVERRIDE_APPLIED,
        message: `Ap dung dieu chinh tieu thu (${usageResult.override?.reason ?? ''})`,
        meta: { override_id: usageResult.override?.id },
      })
    }
    const tiered = config.pricingType === 'tiered'
      ? calculateTieredAmount(usageResult.usage, config.brackets ?? [])
      : null
    const amount = tiered ? tiered.amount : Math.round(usageResult.usage * config.rate)
    lines.push({
      chargeType: meterType,
      label: utilityLabel(meterType),
      sourceType: usageResult.source === 'usage_override' ? 'override' : 'meter_reading',
      sourceId: usageResult.override?.id ?? usageResult.current?.id ?? null,
      quantity: usageResult.usage,
      unitPrice: config.rate,
      amount,
      metadata: {
        pricing_type: config.pricingType,
        rate: config.rate,
        previous_reading_id: usageResult.previous.id,
        previous_reading_value: usageResult.previous.value,
        current_reading_id: usageResult.current?.id ?? null,
        current_reading_value: usageResult.current?.value ?? null,
        old_meter_final_value: usageResult.override?.oldMeterFinalValue ?? null,
        new_meter_start_value: usageResult.override?.newMeterStartValue ?? null,
        billable_usage: usageResult.usage,
        source: usageResult.source,
        tier_breakdown: tiered?.breakdown,
      },
      sortOrder,
    })
  }

  if ((contract.discountAmount ?? 0) > 0) {
    lines.push({
      chargeType: 'discount',
      label: 'Giam gia',
      sourceType: 'contract',
      sourceId: contract.id,
      quantity: 1,
      unitPrice: contract.discountAmount ?? 0,
      amount: contract.discountAmount ?? 0,
      metadata: {},
      sortOrder: 90,
    })
  }
  if ((contract.surchargeAmount ?? 0) > 0) {
    lines.push({
      chargeType: 'surcharge',
      label: 'Phu thu',
      sourceType: 'contract',
      sourceId: contract.id,
      quantity: 1,
      unitPrice: contract.surchargeAmount ?? 0,
      amount: contract.surchargeAmount ?? 0,
      metadata: {},
      sortOrder: 91,
    })
  }

  const subtotalAmount = lines
    .filter(l => l.chargeType !== 'discount' && l.chargeType !== 'surcharge')
    .reduce((sum, line) => sum + line.amount, 0)
  const discountAmount = lines.filter(l => l.chargeType === 'discount').reduce((sum, line) => sum + line.amount, 0)
  const surchargeAmount = lines.filter(l => l.chargeType === 'surcharge').reduce((sum, line) => sum + line.amount, 0)
  return {
    lines,
    blockers,
    warnings,
    subtotalAmount,
    discountAmount,
    surchargeAmount,
    totalAmount: subtotalAmount - discountAmount + surchargeAmount,
  }
}

export interface UtilityBlockerReading {
  meterType: 'electricity' | 'water'
  currentReadingId?: string | null
  requiresOverride?: boolean
  override?: { id?: string | null; reason?: string | null } | null
}

export function findUtilityBlockers(input: {
  contractId: string
  roomId: string
  requiredMeterTypes: Array<'electricity' | 'water'>
  readings: UtilityBlockerReading[]
}): BillingDraftBlocker[] {
  const blockers: BillingDraftBlocker[] = []
  for (const meterType of input.requiredMeterTypes) {
    const reading = input.readings.find(r => r.meterType === meterType)
    if (!reading?.currentReadingId) {
      blockers.push({
        code: BILLING_BLOCKER_CODES.MISSING_CURRENT_READING,
        message: meterType === 'electricity' ? 'Thieu chi so dien' : 'Thieu chi so nuoc',
        meta: { contract_id: input.contractId, room_id: input.roomId, meter_type: meterType },
      })
      continue
    }
    if (reading.requiresOverride && !reading.override) {
      blockers.push({
        code: BILLING_BLOCKER_CODES.NEGATIVE_CONSUMPTION,
        message: 'Can dieu chinh tieu thu truoc khi phat hanh',
        meta: { contract_id: input.contractId, room_id: input.roomId, meter_type: meterType },
      })
      continue
    }
    if (reading.override && !reading.override.reason?.trim()) {
      blockers.push({
        code: BILLING_BLOCKER_CODES.MISSING_BILLING_REFERENCE,
        message: 'Can nhap ly do dieu chinh tieu thu',
        meta: { contract_id: input.contractId, room_id: input.roomId, meter_type: meterType },
      })
    }
  }
  return blockers
}

export function findIssuanceBlockers(inputs: Array<Parameters<typeof findUtilityBlockers>[0]>): BillingDraftBlocker[] {
  return inputs.flatMap(findUtilityBlockers)
}

export function assertPeriodCanTransition(from: BillingPeriod['status'], to: BillingPeriod['status']): void {
  if (from === 'closed' && to !== 'closed') {
    throwConflict('Ky da chot - khong the doi trang thai')
  }
}

export function calculateInvoicePaymentStatus(invoice: Pick<Invoice, 'status' | 'totalAmount' | 'paidAmount'>, paymentAmount: number): Pick<Invoice, 'paidAmount' | 'balanceAmount' | 'status' | 'paidAt'> {
  const paidAmount = invoice.paidAmount + paymentAmount
  const balanceAmount = invoice.totalAmount - paidAmount
  let status: Invoice['status'] = invoice.status
  if (balanceAmount <= 0) status = 'paid'
  else if (paidAmount > 0) status = 'partial'
  return { paidAmount, balanceAmount, status, paidAt: null }
}

export function validateAdjustment(input: {
  periodStatus: BillingPeriod['status'] | null | undefined
  invoicePaidAmount: number
  amount: number
  reason: string
}): void {
  if (input.periodStatus === 'closed') throwConflict('Ky da chot - khong the tao dieu chinh')
  if (input.amount < 0 && Math.abs(input.amount) > input.invoicePaidAmount) {
    throwConflict('Dieu chinh am vuot qua so tien da thu')
  }
  if (input.amount < 0 && Math.abs(input.amount) >= 100_000) {
    assertReason(input.reason, 10)
  }
}
