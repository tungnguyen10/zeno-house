import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { MeterReading, RoomMeterStatus } from '~/types/meter-readings'
import type { MeterReadingAtomicInput, MeterReadingCreateInput, MeterReadingUpdateInput } from '~/utils/validators/meter-readings'
import { mapMeterReading } from '~/utils/mappers/meter-readings'
import type { Tables } from '~/types/database.types'

export interface MeterReadingFilters {
  room_id?: string
  building_id?: string
  buildingIds?: string[] | null
  period_year?: number
  period_month?: number
  meter_type?: string
}

const METER_TYPES = ['electricity', 'water'] as const

function rpcErrorMessage(error: unknown): string {
  return error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : ''
}

export function throwMeterReadingRpcError(error: unknown): never {
  const message = rpcErrorMessage(error)
  if (message.includes('METER_VERSION_CONFLICT')) {
    throwConflict('Chỉ số đã thay đổi. Vui lòng tải lại dữ liệu.', {
      category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true,
    })
  }
  if (message.includes('BILLING_PERIOD_LOCKED')) {
    throwConflict('Kỳ đã chốt, không thể sửa chỉ số.', {
      category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true,
    })
  }
  if (message.includes('BILLING_INVOICE_LOCKED')) {
    throwConflict('Phòng đã có hóa đơn đang hiệu lực, không thể sửa chỉ số.', {
      category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true,
    })
  }
  if (message.includes('METER_')) {
    throwValidationError('Dữ liệu chỉ số không hợp lệ.')
  }
  throwDbError(error, 'meterReadings.saveWithAudit')
}

export const MeterReadingRepository = {
  async saveWithAudit(
    event: H3Event,
    readings: MeterReadingAtomicInput[],
    input: {
      actor_id: string
      source: 'api' | 'ai'
      action_plan_id?: string | null
      idempotency_key?: string | null
    },
  ): Promise<MeterReading[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client.rpc('save_meter_readings_with_audit', {
      p_readings: readings,
      p_actor_id: input.actor_id,
      p_source: input.source,
      p_action_plan_id: input.action_plan_id ?? undefined,
      p_idempotency_key: input.idempotency_key ?? undefined,
    })
    if (error) throwMeterReadingRpcError(error)
    return ((data ?? []) as unknown as Tables<'meter_readings'>[]).map(mapMeterReading)
  },

  async findByRoom(
    event: H3Event,
    roomId: string,
    filters: { period_year?: number; period_month?: number } = {},
  ): Promise<MeterReading[]> {
    const client = await serverSupabaseClient(event)
    let query = client
      .from('meter_readings')
      .select('*')
      .eq('room_id', roomId)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .order('reading_type', { ascending: true })

    if (filters.period_year) query = query.eq('period_year', filters.period_year)
    if (filters.period_month) query = query.eq('period_month', filters.period_month)

    const { data, error } = await query
    if (error) throwDbError(error, 'meterReadings.findByRoom')
    return (data ?? []).map(mapMeterReading)
  },

  async findAll(event: H3Event, filters: MeterReadingFilters = {}): Promise<MeterReading[]> {
    if (filters.buildingIds && filters.buildingIds.length === 0) return []

    const client = await serverSupabaseClient(event)
    let query = client
      .from('meter_readings')
      .select('*')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })

    if (filters.room_id) query = query.eq('room_id', filters.room_id)
    if (filters.building_id) query = query.eq('building_id', filters.building_id)
    else if (filters.buildingIds) query = query.in('building_id', filters.buildingIds)
    if (filters.period_year) query = query.eq('period_year', filters.period_year)
    if (filters.period_month) query = query.eq('period_month', filters.period_month)
    if (filters.meter_type) query = query.eq('meter_type', filters.meter_type)

    const { data, error } = await query
    if (error) throwDbError(error, 'meterReadings.findAll')
    return (data ?? []).map(mapMeterReading)
  },

  async findBuildingRoomsStatus(
    event: H3Event,
    buildingId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<RoomMeterStatus[]> {
    const client = await serverSupabaseClient(event)

    const { data: rooms, error: roomsError } = await client
      .from('rooms')
      .select('id, room_number, floor')
      .eq('building_id', buildingId)
      .eq('status', 'occupied')
      .order('floor', { ascending: true })
      .order('room_number', { ascending: true })

    if (roomsError) throwDbError(roomsError, 'meterReadings.findBuildingRoomsStatus.rooms')
    if (!rooms || rooms.length === 0) return []

    const roomIds = rooms.map(r => r.id)

    const prevMonth = periodMonth === 1 ? 12 : periodMonth - 1
    const prevYear = periodMonth === 1 ? periodYear - 1 : periodYear

    const [currentRes, prevRes, handoverInRes] = await Promise.all([
      client
        .from('meter_readings')
        .select('*')
        .eq('building_id', buildingId)
        .eq('period_year', periodYear)
        .eq('period_month', periodMonth)
        .eq('reading_type', 'monthly')
        .in('room_id', roomIds),
      client
        .from('meter_readings')
        .select('*')
        .eq('building_id', buildingId)
        .eq('period_year', prevYear)
        .eq('period_month', prevMonth)
        .eq('reading_type', 'monthly')
        .in('room_id', roomIds),
      // Fallback: handover_in reading as "previous" for first billing month
      client
        .from('meter_readings')
        .select('*')
        .eq('building_id', buildingId)
        .eq('reading_type', 'handover_in')
        .in('room_id', roomIds),
    ])

    if (currentRes.error) throwDbError(currentRes.error, 'meterReadings.findBuildingRoomsStatus.current')
    if (prevRes.error) throwDbError(prevRes.error, 'meterReadings.findBuildingRoomsStatus.prev')
    if (handoverInRes.error) throwDbError(handoverInRes.error, 'meterReadings.findBuildingRoomsStatus.handoverIn')

    const currentReadings = currentRes.data ?? []
    const prevReadings = prevRes.data ?? []
    const handoverInReadings = handoverInRes.data ?? []

    return rooms.map(room => ({
      roomId: room.id,
      roomNumber: room.room_number,
      floor: room.floor,
      devices: METER_TYPES.map(meterType => {
        const currentRow = currentReadings.find(r => r.room_id === room.id && r.meter_type === meterType)
        const prevMonthlyRow = prevReadings.find(r => r.room_id === room.id && r.meter_type === meterType)
        const handoverRow = handoverInReadings.find(r => r.room_id === room.id && r.meter_type === meterType)
        return {
          meterType,
          existingReading: currentRow ? mapMeterReading(currentRow) : null,
          // Use previous monthly if exists, fall back to handover_in for first billing month
          previousReading: prevMonthlyRow
            ? mapMeterReading(prevMonthlyRow)
            : (handoverRow ? mapMeterReading(handoverRow) : null),
        }
      }),
    }))
  },

  async create(
    event: H3Event,
    input: MeterReadingCreateInput & { building_id: string; recorded_by?: string | null },
  ): Promise<MeterReading> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('meter_readings')
      .insert({
        room_id: input.room_id,
        building_id: input.building_id,
        meter_type: input.meter_type,
        reading_type: input.reading_type,
        period_year: input.period_year,
        period_month: input.period_month,
        reading_date: input.reading_date,
        reading_value: input.reading_value,
        is_estimated: input.is_estimated ?? false,
        notes: input.notes ?? null,
        recorded_by: input.recorded_by ?? null,
      })
      .select()
      .single()

    if (error) throwDbError(error, 'meterReadings.create')
    return mapMeterReading(data)
  },

  async findExistingByConflictKeys(
    event: H3Event,
    keys: Array<{ room_id: string; meter_type: string; period_year: number; period_month: number; reading_type: string }>,
  ): Promise<Map<string, MeterReading>> {
    if (keys.length === 0) return new Map()
    const client = await serverSupabaseClient(event)
    // Fetch any existing readings that match the upsert conflict key set.
    // We then key them by "room_id:meter_type:period_year:period_month:reading_type"
    // so the caller can look up before-snapshots without N individual queries.
    const roomIds = [...new Set(keys.map(k => k.room_id))]
    const periodYears = [...new Set(keys.map(k => k.period_year))]
    const periodMonths = [...new Set(keys.map(k => k.period_month))]
    const { data, error } = await client
      .from('meter_readings')
      .select('*')
      .in('room_id', roomIds)
      .in('period_year', periodYears)
      .in('period_month', periodMonths)
    if (error) throwDbError(error, 'meterReadings.findExistingByConflictKeys')
    const keySet = new Set(keys.map(k => `${k.room_id}:${k.meter_type}:${k.period_year}:${k.period_month}:${k.reading_type}`))
    const result = new Map<string, MeterReading>()
    for (const row of data ?? []) {
      const key = `${row.room_id}:${row.meter_type}:${row.period_year}:${row.period_month}:${row.reading_type}`
      if (keySet.has(key)) result.set(key, mapMeterReading(row))
    }
    return result
  },

  async bulkUpsert(
    event: H3Event,
    readings: Array<MeterReadingCreateInput & { building_id: string; recorded_by?: string | null }>,
  ): Promise<MeterReading[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('meter_readings')
      .upsert(
        readings.map(r => ({
          room_id: r.room_id,
          building_id: r.building_id,
          meter_type: r.meter_type,
          reading_type: r.reading_type,
          period_year: r.period_year,
          period_month: r.period_month,
          reading_date: r.reading_date,
          reading_value: r.reading_value,
          is_estimated: r.is_estimated ?? false,
          notes: r.notes ?? null,
          recorded_by: r.recorded_by ?? null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'room_id,meter_type,period_year,period_month,reading_type' },
      )
      .select()

    if (error) throwDbError(error, 'meterReadings.bulkUpsert')
    return (data ?? []).map(mapMeterReading)
  },

  async update(event: H3Event, id: string, input: MeterReadingUpdateInput): Promise<MeterReading> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('meter_readings')
      .update({
        ...(input.reading_date !== undefined && { reading_date: input.reading_date }),
        ...(input.reading_value !== undefined && { reading_value: input.reading_value }),
        ...(input.is_estimated !== undefined && { is_estimated: input.is_estimated }),
        ...(input.notes !== undefined && { notes: input.notes }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throwDbError(error, 'meterReadings.update')
    return mapMeterReading(data)
  },

  async findById(event: H3Event, id: string): Promise<MeterReading | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('meter_readings')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throwDbError(error, 'meterReadings.findById')
    return data ? mapMeterReading(data) : null
  },

  async findLatestByRoom(
    event: H3Event,
    roomId: string,
    options: { beforeDate?: string } = {},
  ): Promise<{ electricity: MeterReading | null; water: MeterReading | null }> {
    const client = await serverSupabaseClient(event)
    const out: { electricity: MeterReading | null; water: MeterReading | null } = {
      electricity: null,
      water: null,
    }
    for (const meterType of METER_TYPES) {
      let query = client
        .from('meter_readings')
        .select('*')
        .eq('room_id', roomId)
        .eq('meter_type', meterType)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
        .order('reading_date', { ascending: false })
        .limit(1)
      if (options.beforeDate) {
        query = query.lt('reading_date', options.beforeDate)
      }
      const { data, error } = await query.maybeSingle()
      if (error) throwDbError(error, 'meterReadings.findLatestByRoom')
      out[meterType] = data ? mapMeterReading(data) : null
    }
    return out
  },
}
