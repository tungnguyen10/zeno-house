import type { H3Event } from 'h3'
import { db as serverSupabaseClient } from '../../utils/db'
import type { AuthUser } from '~/types/auth'
import type { MeterReading, RoomMeterStatus } from '~/types/meter-readings'
import type { MeterReadingCreateInput, MeterReadingBulkInput, MeterReadingUpdateInput } from '~/utils/validators/meter-readings'
import { BILLING_AUDIT_ACTIONS } from '~/utils/constants/billing'
import { MeterReadingRepository } from '../../repositories/meter-readings'
import { BuildingRepository } from '../../repositories/buildings'
import { RoomRepository } from '../../repositories/rooms'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BillingAuditService } from '../billing/audit'
import { assertBuildingScope, getAssignedBuildingIds } from '../../utils/scope'

export interface MeterReadingFilters {
  room_id?: string
  building_id?: string
  buildingIds?: string[] | null
  period_year?: number
  period_month?: number
  meter_type?: string
}

/**
 * Build audit metadata for a `reading.saved` event, carrying the before/after
 * values so the audit drawer can render an inline diff (e.g. `1500 → 1520`).
 */
function readingDiffMeta(before: MeterReading | null, after: MeterReading) {
  return {
    count: 1,
    meter_type: after.meterType,
    previous_value: before?.readingValue ?? null,
    new_value: after.readingValue,
    unit: after.meterType === 'electricity' ? 'kWh' : 'm³',
    reading_date: after.readingDate,
  }
}

export const MeterReadingService = {
  async list(event: H3Event, _user: AuthUser, filters: MeterReadingFilters): Promise<MeterReading[]> {
    if (!can(_user, 'meter-readings.read')) throwForbidden('Không có quyền xem chỉ số đồng hồ')

    let roomId = filters.room_id
    const buildingIds = await getAssignedBuildingIds(event, _user)
    if (roomId) {
      const room = await RoomRepository.findByIdentifier(event, roomId)
      if (!room) throwNotFound('Không tìm thấy phòng')
      await assertBuildingScope(event, _user, room.buildingId, 'read')
      roomId = room.id
    }

    let buildingId = filters.building_id
    if (buildingId) {
      const building = await BuildingRepository.findByIdentifier(event, buildingId)
      if (!building) throwNotFound('Không tìm thấy tòa nhà')
      if (buildingIds && !buildingIds.includes(building.id)) return []
      buildingId = building.id
    }

    if (roomId) {
      return MeterReadingRepository.findByRoom(event, roomId, {
        period_year: filters.period_year,
        period_month: filters.period_month,
      })
    }
    return MeterReadingRepository.findAll(event, { ...filters, building_id: buildingId, buildingIds })
  },

  async getBuildingStatus(
    event: H3Event,
    _user: AuthUser,
    buildingId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<RoomMeterStatus[]> {
    if (!can(_user, 'meter-readings.read')) throwForbidden('Không có quyền xem chỉ số đồng hồ')
    const building = await BuildingRepository.findByIdentifier(event, buildingId)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, _user, building.id, 'read')
    return MeterReadingRepository.findBuildingRoomsStatus(event, building.id, periodYear, periodMonth)
  },

  async getLatestByRoom(
    event: H3Event,
    _user: AuthUser,
    roomId: string,
    options: { beforeDate?: string } = {},
  ): Promise<{ electricity: MeterReading | null; water: MeterReading | null }> {
    if (!can(_user, 'meter-readings.read')) throwForbidden('Không có quyền xem chỉ số đồng hồ')
    const room = await RoomRepository.findByIdentifier(event, roomId)
    if (!room) throwNotFound('Không tìm thấy phòng')
    await assertBuildingScope(event, _user, room.buildingId, 'read')
    return MeterReadingRepository.findLatestByRoom(event, room.id, options)
  },

  async create(
    event: H3Event,
    _user: AuthUser,
    input: MeterReadingCreateInput,
    userId: string,
  ): Promise<MeterReading> {
    if (!can(_user, 'meter-readings.write')) throwForbidden('Không có quyền nhập chỉ số đồng hồ')
    // Resolve building_id from room
    const supabase = await serverSupabaseClient(event)
    const { data: room } = await supabase
      .from('rooms')
      .select('building_id')
      .eq('id', input.room_id)
      .single()
    if (!room) throw createError({ statusCode: 404, message: 'Không tìm thấy phòng' })
    await assertBuildingScope(event, _user, room.building_id, 'write')
    const created = await MeterReadingRepository.create(event, {
      ...input,
      building_id: room.building_id,
      recorded_by: userId,
    })

    const period = await BillingPeriodRepository.findByBuildingPeriod(
      event, room.building_id, input.period_year, input.period_month,
    )
    await BillingAuditService.append(event, _user, {
      billing_period_id: period?.id ?? null,
      action: BILLING_AUDIT_ACTIONS.READING_SAVED,
      entity_type: 'meter_reading',
      entity_id: created.id,
      before_data: null,
      after_data: created,
      metadata: readingDiffMeta(null, created),
    })

    return created
  },

  async bulkCreate(
    event: H3Event,
    _user: AuthUser,
    input: MeterReadingBulkInput,
    userId: string,
  ): Promise<MeterReading[]> {
    if (!can(_user, 'meter-readings.write')) throwForbidden('Không có quyền nhập chỉ số đồng hồ')
    if (input.readings.length === 0) return []

    // Resolve building_id for all unique room IDs
    const supabase = await serverSupabaseClient(event)
    const roomIds = [...new Set(input.readings.map(r => r.room_id))]
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('id, building_id')
      .in('id', roomIds)
    if (error) throw createError({ statusCode: 500, message: error.message })
    const roomMap = new Map((rooms ?? []).map(r => [r.id, r.building_id]))
    const uniqueBuildingIds = [...new Set(roomMap.values())]
    await Promise.all(uniqueBuildingIds.map(buildingId =>
      assertBuildingScope(event, _user, buildingId, 'write'),
    ))

    const enriched = input.readings.map(r => {
      const buildingId = roomMap.get(r.room_id)
      if (!buildingId) throw createError({ statusCode: 400, message: `Phòng không tồn tại: ${r.room_id}` })
      return { ...r, building_id: buildingId, recorded_by: userId }
    })

    // Pre-fetch existing readings (for before-snapshot) and run upsert in parallel
    const conflictKeys = enriched.map(r => ({
      room_id: r.room_id,
      meter_type: r.meter_type,
      period_year: r.period_year,
      period_month: r.period_month,
      reading_type: r.reading_type,
    }))
    const [beforeMap, saved] = await Promise.all([
      MeterReadingRepository.findExistingByConflictKeys(event, conflictKeys),
      MeterReadingRepository.bulkUpsert(event, enriched),
    ])

    // Resolve unique billing periods in one pass, then append per-reading audit events
    const uniquePeriodKeys = [...new Set(
      saved.map(r => `${r.buildingId}:${r.periodYear}:${r.periodMonth}`),
    )]
    const periodEntries = await Promise.all(
      uniquePeriodKeys.map(async (key) => {
        const [buildingId, year, month] = key.split(':')
        const p = await BillingPeriodRepository.findByBuildingPeriod(
          event, buildingId!, Number(year), Number(month),
        )
        return [key, p?.id ?? null] as const
      }),
    )
    const periodCache = new Map<string, string | null>(periodEntries)

    await Promise.all(saved.map(async (reading) => {
      const conflictKey = `${reading.roomId}:${reading.meterType}:${reading.periodYear}:${reading.periodMonth}:${reading.readingType}`
      const beforeData = beforeMap.get(conflictKey) ?? null
      const periodCacheKey = `${reading.buildingId}:${reading.periodYear}:${reading.periodMonth}`
      await BillingAuditService.append(event, _user, {
        billing_period_id: periodCache.get(periodCacheKey) ?? null,
        action: BILLING_AUDIT_ACTIONS.READING_SAVED,
        entity_type: 'meter_reading',
        entity_id: reading.id,
        before_data: beforeData,
        after_data: reading,
        metadata: readingDiffMeta(beforeData, reading),
      })
    }))

    return saved
  },

  async update(
    event: H3Event,
    _user: AuthUser,
    id: string,
    input: MeterReadingUpdateInput,
  ): Promise<MeterReading> {
    if (!can(_user, 'meter-readings.write')) throwForbidden('Không có quyền sửa chỉ số đồng hồ')
    const existing = await MeterReadingRepository.findById(event, id)
    if (!existing) throw createError({ statusCode: 404, message: 'Không tìm thấy chỉ số' })
    await assertBuildingScope(event, _user, existing.buildingId, 'write')
    const updated = await MeterReadingRepository.update(event, id, input)

    const period = await BillingPeriodRepository.findByBuildingPeriod(
      event, existing.buildingId, existing.periodYear, existing.periodMonth,
    )
    await BillingAuditService.append(event, _user, {
      billing_period_id: period?.id ?? null,
      action: BILLING_AUDIT_ACTIONS.READING_SAVED,
      entity_type: 'meter_reading',
      entity_id: updated.id,
      before_data: existing,
      after_data: updated,
      metadata: readingDiffMeta(existing, updated),
    })

    return updated
  },
}
