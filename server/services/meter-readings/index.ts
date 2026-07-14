import type { H3Event } from 'h3'
import { db as serverSupabaseClient } from '../../utils/db'
import type { AuthUser } from '~/types/auth'
import type { MeterReading, RoomMeterStatus } from '~/types/meter-readings'
import type { MeterReadingAtomicInput, MeterReadingCreateInput, MeterReadingBulkInput, MeterReadingUpdateInput } from '~/utils/validators/meter-readings'
import type { AiMeterImportPayload } from '~/utils/validators/ai'
import { MeterReadingRepository } from '../../repositories/meter-readings'
import { BuildingRepository } from '../../repositories/buildings'
import { RoomRepository } from '../../repositories/rooms'
import { assertBuildingScope, getAssignedBuildingIds } from '../../utils/scope'

export interface MeterReadingFilters {
  room_id?: string
  building_id?: string
  buildingIds?: string[] | null
  period_year?: number
  period_month?: number
  meter_type?: string
}

interface MeterReadingOperationContext {
  source: 'api' | 'ai'
  actionPlanId?: string
  idempotencyKey?: string
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
    const key = {
      room_id: input.room_id,
      meter_type: input.meter_type,
      period_year: input.period_year,
      period_month: input.period_month,
      reading_type: input.reading_type,
    }
    const existing = await MeterReadingRepository.findExistingByConflictKeys(event, [key])
    if (existing.size > 0) throwConflict('Chỉ số của phòng trong kỳ này đã tồn tại.')
    const [created] = await MeterReadingRepository.saveWithAudit(event, [{
      ...input,
      expected_updated_at: null,
    }], { actor_id: userId, source: 'api' })
    if (!created) throwInternal(new Error('Empty meter reading save result'), 'meterReadings.create')
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

    // Validate handover_out readings: value must be >= corresponding handover_in
    const handoverOuts = enriched.filter(r => r.reading_type === 'handover_out')
    if (handoverOuts.length > 0) {
      // Check against any handover_in submitted in the same request first
      const handoverInsInRequest = new Map(
        enriched
          .filter(r => r.reading_type === 'handover_in')
          .map(r => [`${r.room_id}:${r.meter_type}`, r.reading_value]),
      )
      // Then fetch latest existing handover_in from DB for each affected room
      const outRoomIds = [...new Set(handoverOuts.map(r => r.room_id))]
      const { data: existingIns } = await supabase
        .from('meter_readings')
        .select('room_id, meter_type, reading_value')
        .eq('reading_type', 'handover_in')
        .in('room_id', outRoomIds)
        .order('created_at', { ascending: false })
      const handoverInMap = new Map<string, number>()
      for (const row of existingIns ?? []) {
        const key = `${row.room_id}:${row.meter_type}`
        if (!handoverInMap.has(key)) handoverInMap.set(key, row.reading_value as number)
      }
      for (const out of handoverOuts) {
        const key = `${out.room_id}:${out.meter_type}`
        const inValue = handoverInsInRequest.get(key) ?? handoverInMap.get(key)
        if (inValue !== undefined && out.reading_value < inValue) {
          const label = out.meter_type === 'electricity' ? 'điện' : 'nước'
          throwValidationError(`Chỉ số ${label} bàn giao ra (${out.reading_value}) không thể nhỏ hơn chỉ số nhận phòng (${inValue})`)
        }
      }
    }

    // Capture optimistic versions before the atomic RPC. The RPC locks and
    // compares them again before writing any row.
    const conflictKeys = enriched.map(r => ({
      room_id: r.room_id,
      meter_type: r.meter_type,
      period_year: r.period_year,
      period_month: r.period_month,
      reading_type: r.reading_type,
    }))
    const beforeMap = await MeterReadingRepository.findExistingByConflictKeys(event, conflictKeys)
    const atomicReadings: MeterReadingAtomicInput[] = enriched.map((reading) => {
      const key = `${reading.room_id}:${reading.meter_type}:${reading.period_year}:${reading.period_month}:${reading.reading_type}`
      return {
        room_id: reading.room_id,
        meter_type: reading.meter_type,
        period_year: reading.period_year,
        period_month: reading.period_month,
        reading_type: reading.reading_type,
        reading_date: reading.reading_date,
        reading_value: reading.reading_value,
        is_estimated: reading.is_estimated,
        notes: reading.notes,
        expected_updated_at: beforeMap.get(key)?.updatedAt ?? null,
      }
    })
    return MeterReadingRepository.saveWithAudit(event, atomicReadings, { actor_id: userId, source: 'api' })
  },

  async update(
    event: H3Event,
    _user: AuthUser,
    id: string,
    input: MeterReadingUpdateInput,
    operation: MeterReadingOperationContext = { source: 'api' },
  ): Promise<MeterReading> {
    if (!can(_user, 'meter-readings.write')) throwForbidden('Không có quyền sửa chỉ số đồng hồ')
    const existing = await MeterReadingRepository.findById(event, id)
    if (!existing) throw createError({ statusCode: 404, message: 'Không tìm thấy chỉ số' })
    await assertBuildingScope(event, _user, existing.buildingId, 'write')
    const [updated] = await MeterReadingRepository.saveWithAudit(event, [{
      room_id: existing.roomId,
      meter_type: existing.meterType,
      period_year: existing.periodYear,
      period_month: existing.periodMonth,
      reading_type: existing.readingType,
      reading_date: input.reading_date ?? existing.readingDate,
      reading_value: input.reading_value ?? existing.readingValue,
      is_estimated: input.is_estimated ?? existing.isEstimated,
      notes: input.notes === undefined ? existing.notes : input.notes,
      expected_updated_at: input.expected_updated_at,
    }], {
      actor_id: _user.id,
      source: operation.source,
      action_plan_id: operation.actionPlanId,
      idempotency_key: operation.idempotencyKey,
    })
    if (!updated) throwInternal(new Error('Empty meter reading update result'), 'meterReadings.update')
    return updated
  },

  async commitMonthlyImport(
    event: H3Event,
    user: AuthUser,
    input: AiMeterImportPayload,
    operation: MeterReadingOperationContext,
  ): Promise<MeterReading[]> {
    if (!can(user, 'meter-readings.write')) throwForbidden('Không có quyền nhập chỉ số đồng hồ')
    await assertBuildingScope(event, user, input.building_id, 'write')
    const rooms = await RoomRepository.listByBuilding(event, input.building_id)
    const validRoomIds = new Set(rooms.map(room => room.id))
    if (input.readings.some(reading => !validRoomIds.has(reading.room_id))) {
      throwValidationError('Dữ liệu chỉ số chứa phòng không thuộc tòa nhà đã chọn.')
    }
    return MeterReadingRepository.saveWithAudit(event, input.readings.map(reading => ({
      room_id: reading.room_id,
      meter_type: reading.meter_type,
      period_year: input.period_year,
      period_month: input.period_month,
      reading_type: 'monthly',
      reading_date: input.reading_date,
      reading_value: reading.reading_value,
      expected_updated_at: reading.expected_updated_at,
    })), {
      actor_id: user.id,
      source: operation.source,
      action_plan_id: operation.actionPlanId,
      idempotency_key: operation.idempotencyKey,
    })
  },
}
