import type { H3Event } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
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
import { BILLING_BLOCKER_CODES, type BillingBlockerCode } from '~/utils/constants/billing'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BillingUtilityUsageRepository } from '../../repositories/billing/utility-usages'
import { BillingDraftService } from './drafts'

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
  if (draft.warnings.length > 0) return 'warning'
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

    const supabase = await serverSupabaseClient(event)
    const prev = previousPeriod(period.periodYear, period.periodMonth)

    // Building pricing config
    const { data: building, error: bErr } = await supabase
      .from('buildings')
      .select('electricity_pricing_type, default_electricity_rate, water_pricing_type, default_water_rate')
      .eq('id', period.buildingId)
      .single()
    if (bErr) throw createError({ statusCode: 500, message: bErr.message })
    const pricing: BuildingPricing = {
      electricity_pricing_type: building.electricity_pricing_type ?? null,
      default_electricity_rate: building.default_electricity_rate === null ? null : Number(building.default_electricity_rate),
      water_pricing_type: building.water_pricing_type ?? null,
      default_water_rate: building.default_water_rate === null ? null : Number(building.default_water_rate),
    }

    // Rooms in building (including vacant)
    const { data: roomData, error: rErr } = await supabase
      .from('rooms')
      .select('id, room_number, floor, status')
      .eq('building_id', period.buildingId)
      .order('room_number', { ascending: true })
    if (rErr) throw createError({ statusCode: 500, message: rErr.message })
    const rooms: RoomRow[] = (roomData ?? []) as RoomRow[]
    const roomIds = rooms.map(r => r.id)

    // Current period readings (need reading_date for the cell display)
    const { data: currentData, error: cErr } = await supabase
      .from('meter_readings')
      .select('id, room_id, meter_type, reading_value, reading_date')
      .in('room_id', roomIds.length > 0 ? roomIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('period_year', period.periodYear)
      .eq('period_month', period.periodMonth)
      .eq('reading_type', 'monthly')
    if (cErr) throw createError({ statusCode: 500, message: cErr.message })
    const currentByKey = indexByRoomMeter((currentData ?? []) as MeterReadingRow[])

    // Previous period readings
    const { data: prevData, error: pErr } = await supabase
      .from('meter_readings')
      .select('id, room_id, meter_type, reading_value, reading_date')
      .in('room_id', roomIds.length > 0 ? roomIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('period_year', prev.year)
      .eq('period_month', prev.month)
      .eq('reading_type', 'monthly')
    if (pErr) throw createError({ statusCode: 500, message: pErr.message })
    const prevByKey = indexByRoomMeter((prevData ?? []) as MeterReadingRow[])

    // Draft (reuses existing draft service end-to-end)
    const draftResp = await BillingDraftService.calculateDraft(event, user, periodId)
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
    await BillingUtilityUsageRepository.listByPeriod(event, period.id)

    const rows: BillingDraftGridRow[] = []
    let requiredReadingCount = 0
    let completeReadingCount = 0
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

        // Required-reading accounting
        if (elecCell.required) {
          requiredReadingCount += 1
          if (elecCell.currentReadingId || elecCell.source === 'override') completeReadingCount += 1
        }
        if (waterCell.required) {
          requiredReadingCount += 1
          if (waterCell.currentReadingId || waterCell.source === 'override') completeReadingCount += 1
        }

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
    }
  },
}
