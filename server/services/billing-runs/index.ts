import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type {
  BillingRun,
  BillingWorkspaceData,
  BillingWorkspaceMeterReading,
  BillingWorkspaceWarning,
  BillingItemsSummary,
} from '~/types/billing'
import { BillingPeriodRepository } from '../../repositories/billing-periods'
import { BillingRunRepository } from '../../repositories/billing-runs'
import { BillingItemRepository } from '../../repositories/billing-items'
import { BillingContractSnapshotRepository } from '../../repositories/billing-contract-snapshots'
import { BillingServiceSnapshotRepository } from '../../repositories/billing-service-snapshots'
import { BillingUtilitySnapshotRepository } from '../../repositories/billing-utility-snapshots'
import { MeterReadingRepository } from '../../repositories/meter-readings'
import { BuildingRepository } from '../../repositories/buildings'
import { calculateRoomBilling } from '../pricing'
import type { RoomBillingInput } from '../pricing/types'

/**
 * Load data for billing workspace:
 * - Get or create billing period
 * - Return active contracts + meter readings for the period
 * - Auto-populate old_reading from last known reading value
 */
export const BillingRunService = {
  async loadWorkspace(
    event: H3Event,
    user: AuthUser,
    buildingId: string,
    year: number,
    month: number,
  ): Promise<BillingWorkspaceData> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền truy cập workspace thanh toán')

    const client = await serverSupabaseClient(event)

    // Ensure period exists
    let period = await BillingPeriodRepository.findByPeriod(event, buildingId, year, month)
    if (!period) {
      period = await BillingPeriodRepository.create(event, { building_id: buildingId, period_year: year, period_month: month })
    }

    // Building rates
    const building = await BuildingRepository.findById(event, buildingId)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')

    // Existing run (if any)
    const run = await BillingRunRepository.findByPeriod(event, period.id)

    // Active contracts for this building
    const { data: contractRows, error: contractError } = await client
      .from('contracts')
      .select(`
        id, room_id, tenant_id, monthly_rent, surcharge_amount, discount_amount,
        payment_day, occupant_count,
        rooms!inner(id, room_number, floor, building_id),
        tenants!inner(id, full_name),
        contract_services(
          id, catalog_id, amount, quantity, is_enabled,
          service_catalog(name, pricing_type)
        )
      `)
      .eq('rooms.building_id', buildingId)
      .eq('status', 'active')
      .order('rooms(room_number)', { ascending: true })

    if (contractError) throw createError({ statusCode: 500, message: contractError.message })

    const activeContracts = (contractRows ?? []).map((row: any) => ({
      contractId: row.id,
      roomId: row.room_id,
      roomNumber: row.rooms.room_number,
      floor: row.rooms.floor,
      tenantId: row.tenant_id,
      tenantName: row.tenants.full_name,
      monthlyRent: row.monthly_rent,
      surchargeAmount: row.surcharge_amount ?? 0,
      discountAmount: row.discount_amount ?? 0,
      paymentDay: row.payment_day,
      occupantCount: row.occupant_count ?? 1,
      services: (row.contract_services ?? []).map((cs: any) => ({
        contractServiceId: cs.id,
        catalogId: cs.catalog_id,
        name: cs.service_catalog?.name ?? '',
        pricingType: cs.service_catalog?.pricing_type ?? 'fixed',
        amount: cs.amount,
        quantity: cs.quantity,
        isEnabled: cs.is_enabled,
      })),
    }))

    // Existing meter readings for period
    const { data: readingRows, error: readingError } = await client
      .from('meter_readings')
      .select('*')
      .eq('building_id', buildingId)
      .eq('period_year', year)
      .eq('period_month', month)
      .eq('reading_type', 'monthly')

    if (readingError) throw createError({ statusCode: 500, message: readingError.message })

    const existingReadingsMap = new Map<string, any>()
    for (const r of readingRows ?? []) {
      existingReadingsMap.set(`${r.room_id}:${r.meter_type}`, r)
    }

    // Build workspace meter readings with auto-populated old_reading
    const meterReadings: BillingWorkspaceMeterReading[] = []
    for (const contract of activeContracts) {
      for (const meterType of ['electricity', 'water'] as const) {
        const key = `${contract.roomId}:${meterType}`
        const existing = existingReadingsMap.get(key)
        if (existing) {
          meterReadings.push({
            roomId: contract.roomId,
            meterType,
            existingReadingId: existing.id,
            oldReading: existing.old_reading,
            newReading: existing.new_reading ?? existing.reading_value,
            consumption: existing.consumption,
            isAdjusted: existing.is_adjusted ?? false,
            adjustmentReason: existing.adjustment_reason,
          })
        } else {
          // Auto-populate old_reading from latest known reading
          const latest = await MeterReadingRepository.findLatestByRoomAndType(event, contract.roomId, meterType)
          meterReadings.push({
            roomId: contract.roomId,
            meterType,
            existingReadingId: null,
            oldReading: latest?.readingValue ?? null,
            newReading: null,
            consumption: null,
            isAdjusted: false,
            adjustmentReason: null,
          })
        }
      }
    }

    return {
      period,
      run,
      activeContracts,
      meterReadings,
      warnings: [],
      buildingRates: {
        electricityRate: building!.defaultElectricityRate ?? 0,
        waterRate: building!.defaultWaterRate ?? 0,
      },
    }
  },

  /**
   * Preview billing calculation (no DB writes).
   * Negative consumption → warning only (not error).
   */
  async previewBilling(
    event: H3Event,
    user: AuthUser,
    buildingId: string,
    year: number,
    month: number,
  ): Promise<{
    items: Array<{
      contractId: string
      roomId: string
      roomNumber: string
      tenantName: string
      amounts: ReturnType<typeof calculateRoomBilling>['amounts']
      warnings: ReturnType<typeof calculateRoomBilling>['warnings']
    }>
    globalWarnings: BillingWorkspaceWarning[]
  }> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem preview hóa đơn')

    const building = await BuildingRepository.findById(event, buildingId)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')

    const workspace = await BillingRunService.loadWorkspace(event, user, buildingId, year, month)
    const globalWarnings: BillingWorkspaceWarning[] = []
    const items = []

    for (const contract of workspace.activeContracts) {
      const readingsForRoom = workspace.meterReadings.filter(r => r.roomId === contract.roomId)
      const input: RoomBillingInput = {
        contract: {
          id: contract.contractId,
          roomId: contract.roomId,
          tenantId: contract.tenantId,
          monthlyRent: contract.monthlyRent,
          surchargeAmount: contract.surchargeAmount,
          discountAmount: contract.discountAmount,
          paymentDay: contract.paymentDay,
          occupantCount: contract.occupantCount,
        },
        services: contract.services
          .filter(s => s.isEnabled)
          .map(s => ({
            catalogId: s.catalogId,
            name: s.name,
            pricingType: s.pricingType as 'fixed' | 'per_person',
            amount: s.amount,
            quantity: s.quantity,
          })),
        meterReadings: readingsForRoom.map(r => ({
          meterType: r.meterType,
          oldReading: r.oldReading,
          newReading: r.newReading,
          consumption: r.consumption,
          isAdjusted: r.isAdjusted,
          adjustmentReason: r.adjustmentReason,
        })),
        buildingRates: {
          electricityRate: building!.defaultElectricityRate,
          waterRate: building!.defaultWaterRate,
          waterPricingType:
            building!.waterPricingType === 'per_person' ? 'per_person' : 'per_unit',
        },
      }

      const result = calculateRoomBilling(input)
      for (const w of result.warnings) {
        globalWarnings.push({ roomId: contract.roomId, roomNumber: contract.roomNumber, ...w })
      }

      items.push({
        contractId: contract.contractId,
        roomId: contract.roomId,
        roomNumber: contract.roomNumber,
        tenantName: contract.tenantName,
        amounts: result.amounts,
        warnings: result.warnings,
      })
    }

    return { items, globalWarnings }
  },

  /**
   * Generate billing snapshot.
   * - If run exists with paid items → CONFLICT
   * - If run exists with no paid items → delete (CASCADE) then recreate
   * - Negative consumption → VALIDATION_ERROR (blocks generation)
   */
  async generateSnapshot(
    event: H3Event,
    user: AuthUser,
    buildingId: string,
    year: number,
    month: number,
  ): Promise<BillingRun> {
    if (!can(user, 'buildings.update')) throwForbidden('Không có quyền tạo hóa đơn')

    const building = await BuildingRepository.findById(event, buildingId)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')

    const workspace = await BillingRunService.loadWorkspace(event, user, buildingId, year, month)

    // Block generation on finalized period
    if (workspace.period.status === 'finalized') {
      throw createError({ statusCode: 409, message: 'Chu kỳ đã được khóa, không thể tạo hóa đơn' })
    }

    // Check if regenerating
    if (workspace.run) {
      const paidCount = await BillingItemRepository.countPaidByRunId(event, workspace.run.id)
      if (paidCount > 0) {
        throw createError({
          statusCode: 409,
          message: `Không thể tạo lại hóa đơn: có ${paidCount} phòng đã thanh toán`,
        })
      }
      // Delete existing run (CASCADE deletes items + snapshots)
      await BillingRunRepository.deleteById(event, workspace.run.id)
    }

    // Validate: check for negative consumption (blocks generation)
    const negativeErrors: string[] = []
    for (const contract of workspace.activeContracts) {
      const readingsForRoom = workspace.meterReadings.filter(r => r.roomId === contract.roomId)
      for (const reading of readingsForRoom) {
        const consumption =
          !reading.isAdjusted && reading.oldReading != null && reading.newReading != null
            ? reading.newReading - reading.oldReading
            : reading.consumption
        if (consumption != null && consumption < 0) {
          negativeErrors.push(
            `Phòng ${contract.roomNumber} - ${reading.meterType}: tiêu thụ âm (${consumption})`,
          )
        }
      }
    }
    if (negativeErrors.length > 0) {
      throw createError({
        statusCode: 422,
        message: `Lỗi chỉ số điện nước: ${negativeErrors.join('; ')}`,
        data: { code: 'VALIDATION_ERROR', details: negativeErrors },
      })
    }

    // Calculate billing for all contracts
    let totalAmount = 0
    const allResults: Array<{
      contract: (typeof workspace.activeContracts)[number]
      result: ReturnType<typeof calculateRoomBilling>
    }> = []

    for (const contract of workspace.activeContracts) {
      const readingsForRoom = workspace.meterReadings.filter(r => r.roomId === contract.roomId)
      const input: RoomBillingInput = {
        contract: {
          id: contract.contractId,
          roomId: contract.roomId,
          tenantId: contract.tenantId,
          monthlyRent: contract.monthlyRent,
          surchargeAmount: contract.surchargeAmount,
          discountAmount: contract.discountAmount,
          paymentDay: contract.paymentDay,
          occupantCount: contract.occupantCount,
        },
        services: contract.services
          .filter(s => s.isEnabled)
          .map(s => ({
            catalogId: s.catalogId,
            name: s.name,
            pricingType: s.pricingType as 'fixed' | 'per_person',
            amount: s.amount,
            quantity: s.quantity,
          })),
        meterReadings: readingsForRoom.map(r => ({
          meterType: r.meterType,
          oldReading: r.oldReading,
          newReading: r.newReading,
          consumption: r.consumption,
          isAdjusted: r.isAdjusted,
          adjustmentReason: r.adjustmentReason,
        })),
        buildingRates: {
          electricityRate: building!.defaultElectricityRate,
          waterRate: building!.defaultWaterRate,
          waterPricingType:
            building!.waterPricingType === 'per_person' ? 'per_person' : 'per_unit',
        },
      }
      const result = calculateRoomBilling(input)
      totalAmount += result.amounts.totalAmount
      allResults.push({ contract, result })
    }

    // Create the run
    const run = await BillingRunRepository.create(event, {
      billing_period_id: workspace.period.id,
      building_id: buildingId,
      generated_by: user.id,
      item_count: allResults.length,
      total_amount: totalAmount,
    })

    // Insert items + snapshots
    const billingItems = await BillingItemRepository.bulkCreate(
      event,
      allResults.map(({ contract, result }) => ({
        billing_run_id: run.id,
        room_id: contract.roomId,
        contract_id: contract.contractId,
        tenant_id: contract.tenantId,
        rent_amount: result.amounts.rentAmount,
        service_amount: result.amounts.serviceAmount,
        electricity_amount: result.amounts.electricityAmount,
        water_amount: result.amounts.waterAmount,
        utility_amount: result.amounts.utilityAmount,
        total_amount: result.amounts.totalAmount,
      })),
    )

    // Insert snapshots for each item
    for (let i = 0; i < billingItems.length; i++) {
      const item = billingItems[i]!
      const { result } = allResults[i]!

      await BillingContractSnapshotRepository.bulkCreate(event, [
        {
          billing_item_id: item.id,
          monthly_rent: result.contractSnapshot.monthlyRent,
          surcharge_amount: result.contractSnapshot.surchargeAmount,
          discount_amount: result.contractSnapshot.discountAmount,
          payment_day: result.contractSnapshot.paymentDay,
          occupant_count: result.contractSnapshot.occupantCount,
        },
      ])

      await BillingServiceSnapshotRepository.bulkCreate(
        event,
        result.serviceSnapshots.map(s => ({
          billing_item_id: item.id,
          catalog_id: s.catalogId,
          service_name: s.serviceName,
          pricing_type: s.pricingType,
          amount: s.amount,
          quantity: s.quantity,
          total: s.total,
        })),
      )

      await BillingUtilitySnapshotRepository.bulkCreate(
        event,
        result.utilitySnapshots.map(u => ({
          billing_item_id: item.id,
          meter_type: u.meterType,
          old_reading: u.oldReading,
          new_reading: u.newReading,
          consumption: u.consumption,
          unit_price: u.unitPrice,
          total: u.total,
          is_adjusted: u.isAdjusted,
          adjustment_reason: u.adjustmentReason,
        })),
      )
    }

    return run
  },

  async getItemsSummary(
    event: H3Event,
    user: AuthUser,
    billingRunId: string,
  ): Promise<BillingItemsSummary> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem tóm tắt hóa đơn')
    const items = await BillingItemRepository.findByRun(event, billingRunId)

    const summary: BillingItemsSummary = {
      totalRooms: items.length,
      totalReceivable: items.reduce((s, i) => s + i.totalAmount, 0),
      totalPaid: items.filter(i => i.paymentStatus === 'paid').reduce((s, i) => s + i.totalAmount, 0),
      totalUnpaid: items.filter(i => i.paymentStatus === 'unpaid').reduce((s, i) => s + i.totalAmount, 0),
      totalElectricity: items.reduce((s, i) => s + i.electricityAmount, 0),
      totalWater: items.reduce((s, i) => s + i.waterAmount, 0),
    }
    return summary
  },
}
