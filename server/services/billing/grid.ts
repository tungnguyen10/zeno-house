import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type {
  BillingDraftBlocker,
  BillingDraftGridResponse,
  BillingDraftGridRow,
  BillingDraftGridRowStatus,
  BillingDraftGridUtilityCell,
  BillingDraftGridUtilitySource,
  BillingDraftInvoice,
  BillingDraftLine,
  BillingDraftWarning,
} from '~/types/billing'
import {
  BILLING_BLOCKER_CODES,
  BILLING_WARNING_CODES,
  type BillingBlockerCode,
} from '~/utils/constants/billing'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BillingSnapshotRepository } from '../../repositories/billing/snapshot'
import { assertBuildingScope } from '../../utils/scope'
import { calculateRequiredReadingProgress } from './core'
import { BillingDraftService } from './drafts'
import { BillingAuditService } from './audit'

// ---------------------------------------------------------------------------
// Types for source rows
// ---------------------------------------------------------------------------

interface RoomRow {
  id: string
  room_number: string | null
  floor: number | null
  status: string
}

interface MeterReadingRow {
  id: string
  room_id: string
  meter_type: 'electricity' | 'water'
  reading_value: number
  reading_date: string | null
}

interface BuildingPricing {
  name: string | null
  electricity_pricing_type: string | null
  default_electricity_rate: number | null
  water_pricing_type: string | null
  default_water_rate: number | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function previousPeriod(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

function isCurrentPeriod(year: number, month: number): boolean {
  const now = new Date()
  return now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month
}

function periodLastDayISO(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function indexByRoomMeter<T extends { room_id: string; meter_type: string }>(rows: T[]) {
  const m = new Map<string, T>()
  for (const r of rows) m.set(`${r.room_id}::${r.meter_type}`, r)
  return m
}

/**
 * Read a numeric metadata field that may have been stringified as a Postgres
 * `numeric`. Returns null when absent or unparseable.
 */
function metaNumber(meta: Record<string, unknown>, key: string): number | null {
  const v = meta?.[key]
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function metaString(meta: Record<string, unknown>, key: string): string | null {
  const v = meta?.[key]
  return typeof v === 'string' ? v : null
}

function findUtilityLine(lines: BillingDraftLine[], type: 'electricity' | 'water'): BillingDraftLine | null {
  return lines.find(l => l.chargeType === type) ?? null
}

function findUtilityBlocker(blockers: BillingDraftBlocker[], type: 'electricity' | 'water'): BillingBlockerCode | null {
  const codes: BillingBlockerCode[] = type === 'electricity'
    ? [
        BILLING_BLOCKER_CODES.MISSING_ELECTRICITY_RATE,
        BILLING_BLOCKER_CODES.TIERED_ELECTRICITY_UNSUPPORTED,
      ]
    : [
        BILLING_BLOCKER_CODES.MISSING_WATER_RATE,
      ]
  // shared codes are room-scoped — match by meta or message keyword
  for (const b of blockers) {
    if (codes.includes(b.code)) return b.code
  }
  // Missing-current and missing-previous are shared codes; disambiguate by line type via metadata.room_id is shared,
  // so we can only use them when message hints at the meter type.
  for (const b of blockers) {
    const isShared
      = b.code === BILLING_BLOCKER_CODES.MISSING_CURRENT_READING
      || b.code === BILLING_BLOCKER_CODES.MISSING_PREVIOUS_READING
      || b.code === BILLING_BLOCKER_CODES.NEGATIVE_CONSUMPTION
    if (!isShared) continue
    const msg = b.message?.toLowerCase() ?? ''
    if (type === 'electricity' && msg.includes('điện')) return b.code
    if (type === 'water' && msg.includes('nước')) return b.code
  }
  return null
}

// ---------------------------------------------------------------------------
// Cell builders
// ---------------------------------------------------------------------------

function buildBillableCell(
  meterType: 'electricity' | 'water',
  draft: BillingDraftInvoice,
  pricing: BuildingPricing,
  currentReading: MeterReadingRow | undefined,
  previousReading: MeterReadingRow | undefined,
  rowEditable: boolean,
): BillingDraftGridUtilityCell {
  const line = findUtilityLine(draft.lines, meterType)
  const blockerCode = findUtilityBlocker(draft.blockers, meterType)

  const pricingType = meterType === 'electricity'
    ? pricing.electricity_pricing_type
    : pricing.water_pricing_type
  const rate = meterType === 'electricity'
    ? pricing.default_electricity_rate
    : pricing.default_water_rate

  // Determine cell source/values from line metadata when available
  let source: BillingDraftGridUtilitySource = 'monthly'
  let usage: number | null = null
  let amount: number | null = null
  let cellRate: number | null = rate
  let prevId: string | null = previousReading?.id ?? null
  let prevValue: number | null = previousReading?.reading_value ?? null
  let currId: string | null = currentReading?.id ?? null
  let currValue: number | null = currentReading?.reading_value ?? null
  let overrideId: string | null = null

  if (line) {
    const meta = line.metadata
    amount = line.amount
    cellRate = metaNumber(meta, 'rate') ?? rate
    const ms = metaString(meta, 'source')
    if (ms === 'usage_override') source = 'override'
    else if (ms === 'handover_fallback') source = 'handover_fallback'
    else if (ms === 'monthly') source = 'monthly'
    else if (line.sourceType === 'building') {
      // fixed / per_person path
      source = pricingType === 'per_person' ? 'per_person' : 'fixed'
    }
    if (line.sourceType === 'override') {
      overrideId = line.sourceId
      prevId = metaString(meta, 'previous_reading_id')
      prevValue = metaNumber(meta, 'previous_reading_value')
      currId = metaString(meta, 'current_reading_id')
      currValue = metaNumber(meta, 'current_reading_value')
      usage = metaNumber(meta, 'billable_usage')
    } else if (source === 'monthly' || source === 'handover_fallback') {
      prevId = metaString(meta, 'previous_reading_id') ?? prevId
      prevValue = metaNumber(meta, 'previous_reading_value') ?? prevValue
      currId = metaString(meta, 'current_reading_id') ?? currId
      currValue = metaNumber(meta, 'current_reading_value') ?? currValue
      usage = metaNumber(meta, 'billable_usage') ?? line.quantity
    } else if (source === 'fixed') {
      usage = null
    } else if (source === 'per_person') {
      usage = metaNumber(meta, 'occupant_count')
    }
  }

  const required = !!pricingType && (
    pricingType === 'per_kwh'
    || pricingType === 'per_m3'
  )

  return {
    meterType,
    required,
    editable: rowEditable && required && source !== 'override',
    previousReadingId: prevId,
    previousValue: prevValue,
    currentReadingId: currId,
    currentValue: currValue,
    readingDate: currentReading?.reading_date ?? null,
    usage,
    rate: cellRate,
    amount,
    pricingType: pricingType ?? null,
    overrideId,
    source,
    blockerCode,
  }
}

function buildVacantCell(
  meterType: 'electricity' | 'water',
  pricing: BuildingPricing,
  currentReading: MeterReadingRow | undefined,
  previousReading: MeterReadingRow | undefined,
  rowEditable: boolean,
): BillingDraftGridUtilityCell {
  const pricingType = meterType === 'electricity'
    ? pricing.electricity_pricing_type
    : pricing.water_pricing_type
  const rate = meterType === 'electricity'
    ? pricing.default_electricity_rate
    : pricing.default_water_rate
  const usage = currentReading && previousReading
    ? currentReading.reading_value - previousReading.reading_value
    : null
  return {
    meterType,
    required: false,
    editable: rowEditable,
    previousReadingId: previousReading?.id ?? null,
    previousValue: previousReading?.reading_value ?? null,
    currentReadingId: currentReading?.id ?? null,
    currentValue: currentReading?.reading_value ?? null,
    readingDate: currentReading?.reading_date ?? null,
    usage,
    rate,
    amount: null,
    pricingType: pricingType ?? null,
    overrideId: null,
    source: usage !== null ? 'monthly' : 'not_applicable',
    blockerCode: null,
  }
}

// ---------------------------------------------------------------------------
// Status derivation for the row badge
// ---------------------------------------------------------------------------

function deriveBillableStatus(draft: BillingDraftInvoice): BillingDraftGridRowStatus {
  const invStatus = draft.existingInvoiceStatus
  if (invStatus === 'paid') return 'paid'
  if (invStatus === 'partial') return 'partial'
  if (invStatus === 'issued' || invStatus === 'overdue') return 'issued'
  if (draft.blockers.length > 0) {
    const onlyMissing = draft.blockers.every(b =>
      b.code === BILLING_BLOCKER_CODES.MISSING_CURRENT_READING
      || b.code === BILLING_BLOCKER_CODES.MISSING_PREVIOUS_READING,
    )
    if (onlyMissing) return 'missing_reading'
    return 'blocked'
  }
  if (draft.warnings.length > 0) {
    // Informational fallbacks should not force a manual review state.
    // Only actionable warnings (e.g. manual usage overrides) stay in "warning".
    const hasReviewWarning = draft.warnings.some((w) => {
      if (w.code === BILLING_WARNING_CODES.OCCUPANT_FALLBACK_TO_CONTRACT) return false
      if (w.code === BILLING_WARNING_CODES.HANDOVER_FALLBACK_PREVIOUS) return false
      return true
    })
    if (hasReviewWarning) return 'warning'
  }
  return 'ready'
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const BillingDraftGridService = {
  async getGrid(
    event: H3Event,
    user: AuthUser,
    periodId: string,
  ): Promise<BillingDraftGridResponse> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem lưới hoá đơn nháp')

    const period = await BillingPeriodRepository.findById(event, periodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'read')

    const prev = previousPeriod(period.periodYear, period.periodMonth)
    const snapshot = await BillingSnapshotRepository.load(event, period.id)

    // Building pricing config
    const building = snapshot.building
    const pricing: BuildingPricing = {
      name: building.name ?? null,
      electricity_pricing_type: building.electricity_pricing_type ?? null,
      default_electricity_rate: building.default_electricity_rate === null ? null : Number(building.default_electricity_rate),
      water_pricing_type: building.water_pricing_type ?? null,
      default_water_rate: building.default_water_rate === null ? null : Number(building.default_water_rate),
    }

    // Rooms in building (including vacant)
    const rooms = snapshot.rooms as RoomRow[]

    // Current period readings (need reading_date for the cell display)
    const currentData = snapshot.readings.filter(reading => reading.reading_type === 'monthly'
      && reading.period_year === period.periodYear && reading.period_month === period.periodMonth)
      .map(reading => ({ ...reading, reading_value: Number(reading.reading_value) })) as MeterReadingRow[]
    const currentByKey = indexByRoomMeter(currentData)

    // Previous period readings
    const prevData = snapshot.readings.filter(reading => reading.reading_type === 'monthly'
      && reading.period_year === prev.year && reading.period_month === prev.month)
      .map(reading => ({ ...reading, reading_value: Number(reading.reading_value) })) as MeterReadingRow[]
    const prevByKey = indexByRoomMeter(prevData)

    // Draft (reuses existing draft service end-to-end)
    const draftResp = await BillingDraftService.calculateDraft(event, user, periodId, { period, snapshot })
    const draftByContract = new Map<string, BillingDraftInvoice>()
    const draftByRoom = new Map<string, BillingDraftInvoice>()
    for (const d of draftResp.drafts) {
      draftByContract.set(d.contractId, d)
      // Use room-id mapping; if multiple contracts share a room (rare), the last one wins
      draftByRoom.set(d.roomId, d)
    }

    // Build batch reading date default
    const isPeriodClosed = period.status === 'closed'
    const periodEditable = !isPeriodClosed
    const batchReadingDate = isCurrentPeriod(period.periodYear, period.periodMonth)
      ? todayISO()
      : periodLastDayISO(period.periodYear, period.periodMonth)

    // Override metadata for warnings (used directly by draft service, but we may need
    // it for cells where the draft has no electricity/water line — currently not the case).
    const usageOverrides = snapshot.overrides
    const sharedReadingProgress = calculateRequiredReadingProgress({
      contracts: draftResp.drafts.map(draft => ({ room_id: draft.roomId })),
      pricing,
      readings: currentData,
      overrides: usageOverrides.map(override => ({
        roomId: override.roomId,
        meterType: override.meterType,
      })),
    })

    const rows: BillingDraftGridRow[] = []
    const requiredReadingCount = sharedReadingProgress.required
    const completeReadingCount = sharedReadingProgress.complete
    let readyDraftCount = 0
    let blockedDraftCount = 0
    let draftTotalSum = 0

    for (const room of rooms) {
      const draft = draftByRoom.get(room.id) ?? null
      const elecCurrent = currentByKey.get(`${room.id}::electricity`)
      const elecPrev = prevByKey.get(`${room.id}::electricity`)
      const waterCurrent = currentByKey.get(`${room.id}::water`)
      const waterPrev = prevByKey.get(`${room.id}::water`)

      if (draft) {
        const invoiceIsActive = !!draft.existingInvoiceStatus && draft.existingInvoiceStatus !== 'void'
        const rowEditable = periodEditable && !invoiceIsActive
        const elecCell = buildBillableCell('electricity', draft, pricing, elecCurrent, elecPrev, rowEditable)
        const waterCell = buildBillableCell('water', draft, pricing, waterCurrent, waterPrev, rowEditable)

        // rentAndService = total - electricity amount - water amount
        const elecAmt = elecCell.amount ?? 0
        const waterAmt = waterCell.amount ?? 0
        const rentAndServiceTotal = draft.totalAmount - elecAmt - waterAmt

        const status = deriveBillableStatus(draft)
        if (status === 'ready') readyDraftCount += 1
        if (status === 'blocked' || status === 'missing_reading') blockedDraftCount += 1
        if (!invoiceIsActive) draftTotalSum += draft.totalAmount

        rows.push({
          key: `contract:${draft.contractId}`,
          rowType: 'billable_contract',
          roomId: room.id,
          roomNumber: room.room_number,
          floor: room.floor,
          contractId: draft.contractId,
          tenantId: draft.tenantId,
          tenantName: draft.tenantName,
          contractCode: draft.contractCode,
          invoiceId: draft.existingInvoiceId,
          invoiceStatus: draft.existingInvoiceStatus,
          existingInvoice: draft.existingInvoice ?? null,
          editable: rowEditable,
          status,
          electricity: elecCell,
          water: waterCell,
          rentAndServiceTotal,
          draftTotal: draft.totalAmount,
          blockers: draft.blockers,
          warnings: draft.warnings,
          lines: draft.lines,
        })
      } else {
        // Vacant baseline
        const rowEditable = periodEditable
        const elecCell = buildVacantCell('electricity', pricing, elecCurrent, elecPrev, rowEditable)
        const waterCell = buildVacantCell('water', pricing, waterCurrent, waterPrev, rowEditable)

        const blockers: BillingDraftBlocker[] = []
        const warnings: BillingDraftWarning[] = []

        rows.push({
          key: `room:${room.id}`,
          rowType: 'vacant_baseline',
          roomId: room.id,
          roomNumber: room.room_number,
          floor: room.floor,
          contractId: null,
          tenantId: null,
          tenantName: null,
          contractCode: null,
          invoiceId: null,
          invoiceStatus: null,
          existingInvoice: null,
          editable: rowEditable,
          status: 'baseline',
          electricity: elecCell,
          water: waterCell,
          rentAndServiceTotal: 0,
          draftTotal: null,
          blockers,
          warnings,
          lines: [],
        })
      }
    }

    const invoices = snapshot.invoices
    const auditEvents = await BillingAuditService.listByPeriod(event, user, period.id)
    const activeInvoices = invoices.filter(invoice => invoice.status !== 'void')
    const issuedTotal = activeInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)
    const paidTotal = activeInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0)
    const outstandingBalance = activeInvoices.reduce((sum, invoice) => sum + invoice.balanceAmount, 0)

    return {
      period,
      batchReadingDate,
      rows,
      totals: {
        requiredReadingCount,
        completeReadingCount,
        readyDraftCount,
        blockedDraftCount,
        draftTotal: draftTotalSum,
      },
      overview: {
        period,
        buildingId: period.buildingId,
        buildingName: pricing.name,
        contractCount: draftResp.drafts.length,
        invoiceCount: activeInvoices.length,
        readingCompleteCount: completeReadingCount,
        readingRequiredCount: requiredReadingCount,
        draftTotal: 0,
        issuedTotal,
        paidTotal,
        outstandingBalance,
        auditEvents,
      },
    }
  },
}
