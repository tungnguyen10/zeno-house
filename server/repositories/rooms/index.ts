import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Room } from '~/types/rooms'
import type { RoomCreateInput, RoomUpdateInput } from '~/utils/validators/rooms'
import { mapRoom } from '~/utils/mappers/rooms'

export interface RoomFilters {
  buildingId?: string
  status?: string
  floor?: number
}

export const RoomRepository = {
  async findAll(
    event: H3Event,
    filters: RoomFilters = {},
  ): Promise<{ items: Room[]; total: number }> {
    const client = await serverSupabaseClient(event)

    let query = client
      .from('rooms')
      .select('*', { count: 'exact' })
      .order('floor', { ascending: true })
      .order('room_number', { ascending: true })

    if (filters.buildingId) query = query.eq('building_id', filters.buildingId)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.floor !== undefined) query = query.eq('floor', filters.floor)

    const { data, error, count } = await query

    if (error) throw createError({ statusCode: 500, message: error.message })
    return { items: (data ?? []).map(mapRoom), total: count ?? 0 }
  },

  async findById(event: H3Event, id: string): Promise<Room | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('rooms')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapRoom(data) : null
  },

  async insert(event: H3Event, input: RoomCreateInput): Promise<Room> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('rooms')
      .insert({
        building_id: input.building_id,
        room_number: input.room_number,
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
    const client = await serverSupabaseClient(event)
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
    const client = await serverSupabaseClient(event)
    const { error } = await client.from('rooms').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },
}
