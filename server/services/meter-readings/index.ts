import type { H3Event } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import type { AuthUser } from '~/types/auth'
import type { MeterReading, RoomMeterStatus } from '~/types/meter-readings'
import type { MeterReadingCreateInput, MeterReadingBulkInput, MeterReadingUpdateInput } from '~/utils/validators/meter-readings'
import { MeterReadingRepository } from '../../repositories/meter-readings'
import { BuildingRepository } from '../../repositories/buildings'
import { RoomRepository } from '../../repositories/rooms'

export interface MeterReadingFilters {
  room_id?: string
  building_id?: string
  period_year?: number
  period_month?: number
  meter_type?: string
}

export const MeterReadingService = {
  async list(event: H3Event, _user: AuthUser, filters: MeterReadingFilters): Promise<MeterReading[]> {
    if (!can(_user, 'meter-readings.read')) throwForbidden('Không có quyền xem chỉ số đồng hồ')

    let roomId = filters.room_id
    if (roomId) {
      const room = await RoomRepository.findByIdentifier(event, roomId)
      if (!room) throwNotFound('Không tìm thấy phòng')
      roomId = room.id
    }

    let buildingId = filters.building_id
    if (buildingId) {
      const building = await BuildingRepository.findByIdentifier(event, buildingId)
      if (!building) throwNotFound('Không tìm thấy tòa nhà')
      buildingId = building.id
    }

    if (roomId) {
      return MeterReadingRepository.findByRoom(event, roomId, {
        period_year: filters.period_year,
        period_month: filters.period_month,
      })
    }
    return MeterReadingRepository.findAll(event, { ...filters, building_id: buildingId })
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
    return MeterReadingRepository.create(event, {
      ...input,
      building_id: room.building_id,
      recorded_by: userId,
    })
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

    const enriched = input.readings.map(r => {
      const buildingId = roomMap.get(r.room_id)
      if (!buildingId) throw createError({ statusCode: 400, message: `Phòng không tồn tại: ${r.room_id}` })
      return { ...r, building_id: buildingId, recorded_by: userId }
    })

    return MeterReadingRepository.bulkUpsert(event, enriched)
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
    return MeterReadingRepository.update(event, id, input)
  },
}
