import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type {
  BillingDraftBlocker,
  BillingDraftInvoice,
  BillingDraftLine,
  BillingDraftResponse,
  BillingDraftWarning,
  BillingPeriod,
} from '~/types/billing'
import {
  BILLING_BLOCKER_CODES,
  BILLING_WARNING_CODES,
} from '~/utils/constants/billing'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BillingSnapshotRepository } from '../../repositories/billing/snapshot'
import type { BillingPeriodInputSnapshot } from '../../repositories/billing/snapshot'
import { assertBuildingScope } from '../../utils/scope'
import { billingPeriodBounds, type BillableContractPeriodRow } from './core'
import { calculateProratedRent } from './rules'

// ---------------------------------------------------------------------------
// Types describing the source rows we load. Kept local to this service so the
// shapes match the explicit Supabase selects below.
// ---------------------------------------------------------------------------

interface BuildingPricing {
  id: string
  name: string
  electricity_pricing_type: 'per_kwh' | 'fixed' | 'tiered' | null
  default_electricity_rate: number | null
  water_pricing_type: 'per_m3' | 'per_person' | 'fixed_per_room' | null
  default_water_rate: number | null
}

interface ContractRow extends BillableContractPeriodRow {
  id: string
  contract_code: string | null
  building_id: string
  room_id: string
  tenant_id: string
  start_date: string
  end_date: string | null
  monthly_rent: number
  occupant_count: number
  discount_amount: number
  surcharge_amount: number
  payment_day: number | null
  status: string
}

interface ContractServiceRow {
  id: string
  contract_id: string
  catalog_id: string
  amount: number
  quantity: number
  is_enabled: boolean
  service_catalog: {
    id: string
    code: string
    name: string
    pricing_type: 'fixed_per_room' | 'per_person' | 'per_vehicle'
  } | null
}

interface ContractOccupantRow {
  id: string
  contract_id: string
  move_in_date: string
  move_out_date: string | null
  billing_counted: boolean
}

interface MeterReadingRow {
  id: string
  room_id: string
  meter_type: 'electricity' | 'water'
  reading_type: 'monthly' | 'handover_in' | 'handover_out'
  period_year: number
  period_month: number
  reading_value: number
}

interface RoomRow {
  id: string
  room_number: string | null
}

interface TenantRow {
  id: string
  full_name: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function previousPeriod(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

function isOccupantActiveInPeriod(o: ContractOccupantRow, periodFirst: string, periodLast: string): boolean {
  if (o.move_in_date > periodLast) return false
  if (o.move_out_date && o.move_out_date < periodFirst) return false
  return true
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const BillingDraftService = {
  /**
   * Calculate draft invoices for one billing period. Pure read-only.
   */
  async calculateDraft(
    event: H3Event,
    user: AuthUser,
    periodId: string,
    preloaded?: { period: BillingPeriod, snapshot: BillingPeriodInputSnapshot },
  ): Promise<BillingDraftResponse> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem dự thảo')

    const period = preloaded?.period ?? await BillingPeriodRepository.findById(event, periodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'read')

    const { first: firstDay, last: lastDay } = billingPeriodBounds(period.periodYear, period.periodMonth)
    const prev = previousPeriod(period.periodYear, period.periodMonth)
    const snapshot = preloaded?.snapshot ?? await BillingSnapshotRepository.load(event, period.id)

    // Building pricing config
    const building = snapshot.building
    const buildingCfg: BuildingPricing = {
      id: building.id,
      name: building.name,
      electricity_pricing_type: (building.electricity_pricing_type ?? null) as BuildingPricing['electricity_pricing_type'],
      default_electricity_rate: building.default_electricity_rate === null ? null : Number(building.default_electricity_rate),
      water_pricing_type: (building.water_pricing_type ?? null) as BuildingPricing['water_pricing_type'],
      default_water_rate: building.default_water_rate === null ? null : Number(building.default_water_rate),
    }

    // Active contracts for this building/period
    const activeContracts = snapshot.contracts.map(contract => ({
      ...contract,
      monthly_rent: Number(contract.monthly_rent),
      deposit: Number(contract.deposit),
      discount_amount: Number(contract.discount_amount),
      surcharge_amount: Number(contract.surcharge_amount),
    })) as unknown as ContractRow[]

    if (activeContracts.length === 0) {
      return {
        period,
        drafts: [],
        totals: { draftTotal: 0, blockedDraftCount: 0, issuableDraftCount: 0 },
      }
    }

    const roomIds = [...new Set(activeContracts.map(c => c.room_id))]
    // Contract services
    const services = snapshot.services.map(service => ({
      ...service,
      amount: Number(service.amount),
      quantity: Number(service.quantity),
    }))
    const servicesByContract = new Map<string, ContractServiceRow[]>()
    for (const s of (services ?? []) as unknown as ContractServiceRow[]) {
      const list = servicesByContract.get(s.contract_id) ?? []
      list.push(s)
      servicesByContract.set(s.contract_id, list)
    }

    // Contract occupants
    const occupants = snapshot.occupants
    const occupantsByContract = new Map<string, ContractOccupantRow[]>()
    for (const o of (occupants ?? []) as ContractOccupantRow[]) {
      const list = occupantsByContract.get(o.contract_id) ?? []
      list.push(o)
      occupantsByContract.set(o.contract_id, list)
    }

    const snapshotReadings = snapshot.readings.map(reading => ({
      ...reading,
      reading_value: Number(reading.reading_value),
    })) as unknown as MeterReadingRow[]
    const currentReadings = snapshotReadings.filter(reading => reading.reading_type === 'monthly'
      && reading.period_year === period.periodYear && reading.period_month === period.periodMonth)
    const prevReadings = snapshotReadings.filter(reading => reading.reading_type === 'monthly'
      && reading.period_year === prev.year && reading.period_month === prev.month)
    const handoverReadings = snapshotReadings.filter(reading => reading.reading_type === 'handover_in')

    const indexByRoomMeter = (rows: MeterReadingRow[]) => {
      const m = new Map<string, MeterReadingRow>()
      for (const r of rows) m.set(`${r.room_id}::${r.meter_type}`, r)
      return m
    }
    const currentByRoomMeter = indexByRoomMeter((currentReadings ?? []) as MeterReadingRow[])
    const prevByRoomMeter = indexByRoomMeter((prevReadings ?? []) as MeterReadingRow[])
    const handoverByRoomMeter = indexByRoomMeter((handoverReadings ?? []) as MeterReadingRow[])

    // Utility usage overrides for this period
    const overrides = snapshot.overrides
    const overrideByRoomMeter = new Map<string, (typeof overrides)[number]>()
    for (const ov of overrides) overrideByRoomMeter.set(`${ov.roomId}::${ov.meterType}`, ov)

    // Existing invoices for this period (active = non-void)
    const existingInvoices = snapshot.invoices
    const activeInvoiceByContract = new Map<string, (typeof existingInvoices)[number]>()
    for (const inv of existingInvoices) {
      if (inv.status !== 'void') activeInvoiceByContract.set(inv.contractId, inv)
    }

    // Rooms + tenants for display
    const rooms = snapshot.rooms.filter(room => roomIds.includes(room.id))
    const roomById = new Map<string, RoomRow>(((rooms ?? []) as RoomRow[]).map(r => [r.id, r]))

    const tenants = snapshot.tenants
    const tenantById = new Map<string, TenantRow>(((tenants ?? []) as TenantRow[]).map(t => [t.id, t]))

    // ----- Build a draft invoice per active contract -----
    const drafts: BillingDraftInvoice[] = []
    let draftTotalSum = 0
    let blockedCount = 0
    let issuableCount = 0

    for (const contract of activeContracts) {
      const blockers: BillingDraftBlocker[] = []
      const warnings: BillingDraftWarning[] = []
      const lines: BillingDraftLine[] = []

      // Duplicate invoice block
      const existing = activeInvoiceByContract.get(contract.id) ?? null
      if (existing) {
        blockers.push({
          code: BILLING_BLOCKER_CODES.DUPLICATE_INVOICE,
          message: 'Đã có hoá đơn còn hiệu lực cho hợp đồng này trong kỳ',
          meta: { invoice_id: existing.id, status: existing.status },
        })
      }

      // 1) Rent
      const rent = calculateProratedRent({
        monthlyRent: contract.monthly_rent,
        periodYear: period.periodYear,
        periodMonth: period.periodMonth,
        startDate: contract.start_date,
        endDate: contract.end_date,
      })
      lines.push({
        chargeType: 'rent',
        label: 'Tiền phòng',
        sourceType: 'contract',
        sourceId: contract.id,
        quantity: rent.billableDays / rent.periodDays,
        unitPrice: contract.monthly_rent,
        amount: rent.amount,
        metadata: {
          monthly_rent: contract.monthly_rent,
          billable_days: rent.billableDays,
          period_days: rent.periodDays,
        },
        sortOrder: 0,
      })

      // 2) Electricity
      const elecKey = `${contract.room_id}::electricity`
      const elecOverride = overrideByRoomMeter.get(elecKey)
      const elecCurrent = currentByRoomMeter.get(elecKey)
      const elecPrev = prevByRoomMeter.get(elecKey)
      const elecHandover = handoverByRoomMeter.get(elecKey)
      const elecPricing = buildingCfg.electricity_pricing_type
      const elecRate = buildingCfg.default_electricity_rate

      if (!elecPricing) {
        blockers.push({
          code: BILLING_BLOCKER_CODES.MISSING_ELECTRICITY_RATE,
          message: 'Chưa cấu hình loại giá điện',
          meta: { room_id: contract.room_id },
        })
      } else if (elecPricing === 'tiered') {
        blockers.push({
          code: BILLING_BLOCKER_CODES.TIERED_ELECTRICITY_UNSUPPORTED,
          message: 'Toà nhà cấu hình điện bậc thang — chưa hỗ trợ trong v1',
          meta: { room_id: contract.room_id },
        })
      } else if (elecRate === null) {
        blockers.push({
          code: BILLING_BLOCKER_CODES.MISSING_ELECTRICITY_RATE,
          message: 'Chưa cấu hình giá điện mặc định',
          meta: { room_id: contract.room_id },
        })
      } else if (elecPricing === 'fixed') {
        lines.push({
          chargeType: 'electricity',
          label: 'Tiền điện (cố định)',
          sourceType: 'building',
          sourceId: buildingCfg.id,
          quantity: 1,
          unitPrice: elecRate,
          amount: elecRate,
          metadata: { pricing_type: 'fixed', rate: elecRate },
          sortOrder: 1,
        })
      } else {
        // per_kwh: needs current+previous (or override)
        if (elecOverride) {
          const amount = Math.round(elecOverride.billableUsage * elecRate)
          lines.push({
            chargeType: 'electricity',
            label: 'Tiền điện',
            sourceType: 'override',
            sourceId: elecOverride.id,
            quantity: elecOverride.billableUsage,
            unitPrice: elecRate,
            amount,
            metadata: {
              pricing_type: 'per_kwh',
              rate: elecRate,
              previous_reading_id: elecOverride.previousReadingId,
              previous_reading_value: elecOverride.previousReadingValue,
              current_reading_id: elecOverride.currentReadingId,
              current_reading_value: elecOverride.currentReadingValue,
              old_meter_final_value: elecOverride.oldMeterFinalValue,
              new_meter_start_value: elecOverride.newMeterStartValue,
              billable_usage: elecOverride.billableUsage,
              reason: elecOverride.reason,
              source: 'usage_override',
            },
            sortOrder: 1,
          })
          warnings.push({
            code: BILLING_WARNING_CODES.USAGE_OVERRIDE_APPLIED,
            message: `Áp dụng điều chỉnh tiêu thụ điện (${elecOverride.reason})`,
            meta: { override_id: elecOverride.id },
          })
        } else if (!elecCurrent) {
          blockers.push({
            code: BILLING_BLOCKER_CODES.MISSING_CURRENT_READING,
            message: 'Thiếu chỉ số điện kỳ này',
            meta: { room_id: contract.room_id },
          })
        } else {
          const previousRow = elecPrev ?? elecHandover
          if (!previousRow) {
            blockers.push({
              code: BILLING_BLOCKER_CODES.MISSING_PREVIOUS_READING,
              message: 'Thiếu chỉ số điện kỳ trước (và không có handover_in)',
              meta: { room_id: contract.room_id },
            })
          } else {
            const usage = elecCurrent.reading_value - previousRow.reading_value
            if (usage < 0) {
              blockers.push({
                code: BILLING_BLOCKER_CODES.NEGATIVE_CONSUMPTION,
                message: 'Chỉ số điện kỳ này nhỏ hơn kỳ trước — cần điều chỉnh tiêu thụ',
                meta: { room_id: contract.room_id, current: elecCurrent.reading_value, previous: previousRow.reading_value },
              })
            } else {
              const amount = Math.round(usage * elecRate)
              const isHandoverFallback = !elecPrev && !!elecHandover
              if (isHandoverFallback) {
                warnings.push({
                  code: BILLING_WARNING_CODES.HANDOVER_FALLBACK_PREVIOUS,
                  message: 'Sử dụng chỉ số bàn giao đầu kỳ làm chỉ số kỳ trước',
                  meta: { room_id: contract.room_id, handover_id: elecHandover?.id },
                })
              }
              lines.push({
                chargeType: 'electricity',
                label: 'Tiền điện',
                sourceType: 'meter_reading',
                sourceId: elecCurrent.id,
                quantity: usage,
                unitPrice: elecRate,
                amount,
                metadata: {
                  pricing_type: 'per_kwh',
                  rate: elecRate,
                  previous_reading_id: previousRow.id,
                  previous_reading_value: previousRow.reading_value,
                  current_reading_id: elecCurrent.id,
                  current_reading_value: elecCurrent.reading_value,
                  billable_usage: usage,
                  source: isHandoverFallback ? 'handover_fallback' : 'monthly',
                },
                sortOrder: 1,
              })
            }
          }
        }
      }

      // 3) Water
      const waterKey = `${contract.room_id}::water`
      const waterOverride = overrideByRoomMeter.get(waterKey)
      const waterCurrent = currentByRoomMeter.get(waterKey)
      const waterPrev = prevByRoomMeter.get(waterKey)
      const waterHandover = handoverByRoomMeter.get(waterKey)
      const waterPricing = buildingCfg.water_pricing_type
      const waterRate = buildingCfg.default_water_rate

      if (!waterPricing) {
        blockers.push({
          code: BILLING_BLOCKER_CODES.MISSING_WATER_RATE,
          message: 'Chưa cấu hình loại giá nước',
          meta: { room_id: contract.room_id },
        })
      } else if (waterRate === null) {
        blockers.push({
          code: BILLING_BLOCKER_CODES.MISSING_WATER_RATE,
          message: 'Chưa cấu hình giá nước mặc định',
          meta: { room_id: contract.room_id },
        })
      } else if (waterPricing === 'fixed_per_room') {
        lines.push({
          chargeType: 'water',
          label: 'Tiền nước (cố định)',
          sourceType: 'building',
          sourceId: buildingCfg.id,
          quantity: 1,
          unitPrice: waterRate,
          amount: waterRate,
          metadata: { pricing_type: 'fixed_per_room', rate: waterRate },
          sortOrder: 2,
        })
      } else if (waterPricing === 'per_person') {
        // Use occupant rows when available, otherwise fall back to contract.occupant_count.
        const periodOccupants = (occupantsByContract.get(contract.id) ?? []).filter(
          o => o.billing_counted && isOccupantActiveInPeriod(o, firstDay, lastDay),
        )
        let occupantCount = periodOccupants.length
        let occupantSource: 'contract_occupants' | 'contract_fallback' = 'contract_occupants'
        if (occupantCount === 0) {
          // No occupant rows at all — warn and fall back to contract declaration.
          occupantCount = contract.occupant_count
          occupantSource = 'contract_fallback'
          warnings.push({
            code: BILLING_WARNING_CODES.OCCUPANT_FALLBACK_TO_CONTRACT,
            message: 'Dùng số người trên hợp đồng (không có dữ liệu occupants)',
            meta: { contract_id: contract.id, fallback_count: occupantCount },
          })
        } else if (occupantCount < contract.occupant_count) {
          // Fewer active occupant rows than declared — use contract count as floor, no warning needed.
          occupantCount = contract.occupant_count
          occupantSource = 'contract_fallback'
        }
        const amount = Math.round(occupantCount * waterRate)
        lines.push({
          chargeType: 'water',
          label: 'Tiền nước (theo người)',
          sourceType: 'building',
          sourceId: buildingCfg.id,
          quantity: occupantCount,
          unitPrice: waterRate,
          amount,
          metadata: {
            pricing_type: 'per_person',
            rate: waterRate,
            occupant_count: occupantCount,
            occupant_source: occupantSource,
          },
          sortOrder: 2,
        })
      } else {
        // per_m3
        if (waterOverride) {
          const amount = Math.round(waterOverride.billableUsage * waterRate)
          lines.push({
            chargeType: 'water',
            label: 'Tiền nước',
            sourceType: 'override',
            sourceId: waterOverride.id,
            quantity: waterOverride.billableUsage,
            unitPrice: waterRate,
            amount,
            metadata: {
              pricing_type: 'per_m3',
              rate: waterRate,
              previous_reading_id: waterOverride.previousReadingId,
              previous_reading_value: waterOverride.previousReadingValue,
              current_reading_id: waterOverride.currentReadingId,
              current_reading_value: waterOverride.currentReadingValue,
              old_meter_final_value: waterOverride.oldMeterFinalValue,
              new_meter_start_value: waterOverride.newMeterStartValue,
              billable_usage: waterOverride.billableUsage,
              reason: waterOverride.reason,
              source: 'usage_override',
            },
            sortOrder: 2,
          })
          warnings.push({
            code: BILLING_WARNING_CODES.USAGE_OVERRIDE_APPLIED,
            message: `Áp dụng điều chỉnh tiêu thụ nước (${waterOverride.reason})`,
            meta: { override_id: waterOverride.id },
          })
        } else if (!waterCurrent) {
          blockers.push({
            code: BILLING_BLOCKER_CODES.MISSING_CURRENT_READING,
            message: 'Thiếu chỉ số nước kỳ này',
            meta: { room_id: contract.room_id },
          })
        } else {
          const previousRow = waterPrev ?? waterHandover
          if (!previousRow) {
            blockers.push({
              code: BILLING_BLOCKER_CODES.MISSING_PREVIOUS_READING,
              message: 'Thiếu chỉ số nước kỳ trước (và không có handover_in)',
              meta: { room_id: contract.room_id },
            })
          } else {
            const usage = waterCurrent.reading_value - previousRow.reading_value
            if (usage < 0) {
              blockers.push({
                code: BILLING_BLOCKER_CODES.NEGATIVE_CONSUMPTION,
                message: 'Chỉ số nước kỳ này nhỏ hơn kỳ trước — cần điều chỉnh tiêu thụ',
                meta: { room_id: contract.room_id, current: waterCurrent.reading_value, previous: previousRow.reading_value },
              })
            } else {
              const amount = Math.round(usage * waterRate)
              const isHandoverFallback = !waterPrev && !!waterHandover
              if (isHandoverFallback) {
                warnings.push({
                  code: BILLING_WARNING_CODES.HANDOVER_FALLBACK_PREVIOUS,
                  message: 'Sử dụng chỉ số bàn giao đầu kỳ làm chỉ số kỳ trước',
                  meta: { room_id: contract.room_id, handover_id: waterHandover?.id },
                })
              }
              lines.push({
                chargeType: 'water',
                label: 'Tiền nước',
                sourceType: 'meter_reading',
                sourceId: waterCurrent.id,
                quantity: usage,
                unitPrice: waterRate,
                amount,
                metadata: {
                  pricing_type: 'per_m3',
                  rate: waterRate,
                  previous_reading_id: previousRow.id,
                  previous_reading_value: previousRow.reading_value,
                  current_reading_id: waterCurrent.id,
                  current_reading_value: waterCurrent.reading_value,
                  billable_usage: usage,
                  source: isHandoverFallback ? 'handover_fallback' : 'monthly',
                },
                sortOrder: 2,
              })
            }
          }
        }
      }

      // 4) Services
      let serviceSort = 3
      for (const svc of servicesByContract.get(contract.id) ?? []) {
        const amount = Math.round(svc.amount * svc.quantity)
        lines.push({
          chargeType: 'service',
          label: svc.service_catalog?.name ?? 'Dịch vụ',
          sourceType: 'contract_service',
          sourceId: svc.id,
          quantity: svc.quantity,
          unitPrice: svc.amount,
          amount,
          metadata: {
            contract_service_id: svc.id,
            catalog_id: svc.catalog_id,
            catalog_code: svc.service_catalog?.code,
            pricing_type: svc.service_catalog?.pricing_type,
          },
          sortOrder: serviceSort,
        })
        serviceSort += 1
      }

      // 5) Discount and surcharge.
      // Discount line carries a negative amount so SUM(line.amount) == total_amount
      // (the invariant enforced by issue_period_invoices). The aggregate
      // `discountAmount` returned by this service stays positive.
      if (contract.discount_amount > 0) {
        lines.push({
          chargeType: 'discount',
          label: 'Giảm giá',
          sourceType: 'contract',
          sourceId: contract.id,
          quantity: 1,
          unitPrice: contract.discount_amount,
          amount: -contract.discount_amount,
          metadata: {},
          sortOrder: 90,
        })
      }
      if (contract.surcharge_amount > 0) {
        lines.push({
          chargeType: 'surcharge',
          label: 'Phụ thu',
          sourceType: 'contract',
          sourceId: contract.id,
          quantity: 1,
          unitPrice: contract.surcharge_amount,
          amount: contract.surcharge_amount,
          metadata: {},
          sortOrder: 91,
        })
      }

      // Totals
      const subtotal = lines
        .filter(l => l.chargeType !== 'discount' && l.chargeType !== 'surcharge')
        .reduce((s, l) => s + l.amount, 0)
      const discountAmt = -lines
        .filter(l => l.chargeType === 'discount')
        .reduce((s, l) => s + l.amount, 0)
      const surchargeAmt = lines
        .filter(l => l.chargeType === 'surcharge')
        .reduce((s, l) => s + l.amount, 0)
      const total = subtotal - discountAmt + surchargeAmt

      const room = roomById.get(contract.room_id) ?? null
      const tenant = tenantById.get(contract.tenant_id) ?? null

      const draft: BillingDraftInvoice = {
        contractId: contract.id,
        roomId: contract.room_id,
        tenantId: contract.tenant_id,
        contractCode: contract.contract_code ?? null,
        roomNumber: room?.room_number ?? null,
        tenantName: tenant?.full_name ?? null,
        lines,
        subtotalAmount: subtotal,
        discountAmount: discountAmt,
        surchargeAmount: surchargeAmt,
        totalAmount: total,
        blockers,
        warnings,
        existingInvoiceId: existing?.id ?? null,
        existingInvoiceStatus: existing?.status ?? null,
        existingInvoice: existing
          ? {
              id: existing.id,
              totalAmount: existing.totalAmount,
              paidAmount: existing.paidAmount,
              status: existing.status,
            }
          : null,
      }
      drafts.push(draft)
      // Only sum drafts that would actually be issued — a contract with an
      // active invoice is blocked by DUPLICATE_INVOICE, so its draft total
      // never lands in a real issue. Mirrors grid.ts treatment.
      if (!existing) draftTotalSum += total
      if (blockers.length > 0) blockedCount += 1
      else issuableCount += 1
    }

    return {
      period,
      drafts,
      totals: {
        draftTotal: draftTotalSum,
        blockedDraftCount: blockedCount,
        issuableDraftCount: issuableCount,
      },
    }
  },

  /**
   * Re-fetch period and return the BillingPeriod alone (used by callers that
   * just want the active period after status change).
   */
  async getPeriod(event: H3Event, periodId: string): Promise<BillingPeriod | null> {
    return BillingPeriodRepository.findById(event, periodId)
  },
}
