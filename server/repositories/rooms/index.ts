import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Room, RoomStatus } from '~/types/rooms'
import type { RoomCreateInput, RoomUpdateInput } from '~/utils/validators/rooms'
import { mapRoom } from '~/utils/mappers/rooms'
import { isUuid, slugifyName } from '~/utils/format/slug'

export interface RoomFilters {
  buildingId?: string
  buildingIds?: string[] | null
  status?: RoomStatus[]
  floor?: number
  page?: number
  limit?: number
  q?: string
  sort?: 'room_number' | 'floor' | 'monthly_rent' | 'created_at'
  order?: 'asc' | 'desc'
}

export const RoomRepository = {
  async findAll(
    event: H3Event,
    filters: RoomFilters = {},
  ): Promise<{ items: Room[]; total: number }> {
    if (filters.buildingIds && filters.buildingIds.length === 0) {
      return { items: [], total: 0 }
    }

    // Authorization and scope checks are enforced in RoomService.
    const client = serverSupabaseServiceRole(event)
    const page = filters.page ?? 1
    const limit = filters.limit ?? 20
    const from = (page - 1) * limit
    const to = from + limit - 1
    const sort = filters.sort ?? 'floor'
    const order = filters.order ?? 'asc'
    const ascending = order === 'asc'

    let query = client
      .from('rooms')
      .select('*', { count: 'exact' })

    if (filters.buildingId) query = query.eq('building_id', filters.buildingId)
    else if (filters.buildingIds) query = query.in('building_id', filters.buildingIds)
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }
    else {
      query = query.not('status', 'eq', 'archived')
    }
    if (filters.floor !== undefined) query = query.eq('floor', filters.floor)
    if (filters.q && filters.q.trim()) {
      const term = filters.q.trim().replace(/[,()]/g, '')
      query = query.or(
        `room_number.ilike.%${term}%,code.ilike.%${term}%,description.ilike.%${term}%`,
      )
    }

    query = query.order(sort, { ascending })
    if (sort !== 'room_number') query = query.order('room_number', { ascending: true })
    if (sort !== 'floor') query = query.order('floor', { ascending: true })
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw createError({ statusCode: 500, message: error.message })
    return { items: (data ?? []).map(mapRoom), total: count ?? 0 }
  },

  async findById(event: H3Event, id: string): Promise<Room | null> {
    // Authorization and scope checks are enforced in RoomService.
    const client = serverSupabaseServiceRole(event)
    const { data, error } = await client
      .from('rooms')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapRoom(data) : null
  },

  async findByBuildingAndRoomSlug(
    event: H3Event,
    buildingId: string,
    roomSlug: string,
  ): Promise<Room | null> {
    // Authorization and scope checks are enforced in RoomService.
    const client = serverSupabaseServiceRole(event)
    const { data, error } = await client
      .from('rooms')
      .select('*')
      .eq('building_id', buildingId)

    if (error) throw createError({ statusCode: 500, message: error.message })
    const row = (data ?? []).find(room => slugifyName(room.room_number) === roomSlug)
    return row ? mapRoom(row) : null
  },

  async insert(event: H3Event, input: RoomCreateInput): Promise<Room> {
    // Authorization and scope checks are enforced in RoomService.
    const client = serverSupabaseServiceRole(event)

    // Generate slug from room_number
    const roomSlug = slugifyName(input.room_number) || input.room_number.toLowerCase()

    // Fetch building code to compose room code
    const { data: buildingRow, error: buildingError } = await client
      .from('buildings')
      .select('code')
      .eq('id', input.building_id)
      .single()
    if (buildingError || !buildingRow) {
      throw createError({ statusCode: 500, message: 'Cannot resolve building code for room' })
    }
    const roomCode = `${buildingRow.code}-${roomSlug}`

    const { data, error } = await client
      .from('rooms')
      .insert({
        building_id: input.building_id,
        room_number: input.room_number,
        slug: roomSlug,
        code: roomCode,
        floor: input.floor,
        status: input.status ?? 'available',
        monthly_rent: input.monthly_rent,
        area: input.area ?? null,
        description: input.description ?? null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw createError({ statusCode: 409, message: `Số phòng "${input.room_number}" đã tồn tại trong tòa nhà này` })
      }
      throw createError({ statusCode: 500, message: error.message })
    }
    return mapRoom(data)
  },

  async update(event: H3Event, id: string, input: RoomUpdateInput): Promise<Room> {
    // Authorization and scope checks are enforced in RoomService.
    const client = serverSupabaseServiceRole(event)
    const { data, error } = await client
      .from('rooms')
      .update({
        ...(input.room_number !== undefined && { room_number: input.room_number }),
        ...(input.floor !== undefined && { floor: input.floor }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.monthly_rent !== undefined && { monthly_rent: input.monthly_rent }),
        ...(input.area !== undefined && { area: input.area }),
        ...(input.description !== undefined && { description: input.description }),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw createError({ statusCode: 409, message: `Số phòng "${input.room_number}" đã tồn tại trong tòa nhà này` })
      }
      throw createError({ statusCode: 500, message: error.message })
    }
    return mapRoom(data)
  },

  async remove(event: H3Event, id: string): Promise<void> {
    // Authorization and scope checks are enforced in RoomService.
    const client = serverSupabaseServiceRole(event)
    const { error } = await client.from('rooms').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },

  async countActiveContractsForRoom(event: H3Event, roomId: string): Promise<number> {
    // Authorization and scope checks are enforced in RoomService.
    const client = serverSupabaseServiceRole(event)
    const { count, error } = await client
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('status', 'active')
    if (error) throw createError({ statusCode: 500, message: error.message })
    return count ?? 0
  },

  async countMeterReadingsForRoom(event: H3Event, roomId: string): Promise<number> {
    // Authorization and scope checks are enforced in RoomService.
    const client = serverSupabaseServiceRole(event)
    const { count, error } = await client
      .from('meter_readings')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return count ?? 0
  },

  async softArchive(event: H3Event, id: string): Promise<Room> {
    // Authorization and scope checks are enforced in RoomService.
    const client = serverSupabaseServiceRole(event)
    const { data, error } = await client
      .from('rooms')
      .update({ status: 'archived' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapRoom(data)
  },

  async findByIdentifier(event: H3Event, identifier: string): Promise<Room | null> {
    // Authorization and scope checks are enforced in RoomService.
    const client = serverSupabaseServiceRole(event)
    const column = isUuid(identifier) ? 'id' : 'code'
    const { data, error } = await client
      .from('rooms')
      .select('*')
      .eq(column, identifier)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapRoom(data) : null
  },
}
