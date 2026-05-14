import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { RoomAssignment, RoomAssignmentWithTenant, RoomAssignmentWithRoom } from '~/types/room-assignments'
import type { AssignInput } from '~/utils/validators/room-assignments'
import { mapRoomAssignment } from '~/utils/mappers/room-assignments'

export const RoomAssignmentRepository = {
  async findActiveByRoom(event: H3Event, roomId: string): Promise<RoomAssignmentWithTenant | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('room_assignments')
      .select('*, tenant:tenants(id, full_name, phone)')
      .eq('room_id', roomId)
      .is('end_date', null)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!data) return null

    const base = mapRoomAssignment(data)
    const tenant = data.tenant as { id: string; full_name: string; phone: string } | null
    if (!tenant) return null

    return {
      ...base,
      tenant: {
        id: tenant.id,
        fullName: tenant.full_name,
        phone: tenant.phone,
      },
    }
  },

  async findActiveByTenant(event: H3Event, tenantId: string): Promise<RoomAssignmentWithRoom | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('room_assignments')
      .select('*, room:rooms(id, room_number, floor, building_id, building:buildings(name))')
      .eq('tenant_id', tenantId)
      .is('end_date', null)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!data) return null

    const base = mapRoomAssignment(data)
    const room = data.room as { id: string; room_number: string; floor: number; building_id: string; building: { name: string } | null } | null
    if (!room) return null

    return {
      ...base,
      room: {
        id: room.id,
        roomNumber: room.room_number,
        floor: room.floor,
        buildingId: room.building_id,
        buildingName: room.building?.name ?? '',
      },
    }
  },

  async findById(event: H3Event, id: string): Promise<RoomAssignment | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('room_assignments')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapRoomAssignment(data) : null
  },

  async insert(event: H3Event, input: AssignInput): Promise<RoomAssignment> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('room_assignments')
      .insert({
        room_id: input.room_id,
        tenant_id: input.tenant_id,
        start_date: input.start_date,
        notes: input.notes ?? null,
      })
      .select()
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapRoomAssignment(data)
  },

  async end(event: H3Event, id: string, endDate: string): Promise<RoomAssignment> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('room_assignments')
      .update({ end_date: endDate })
      .eq('id', id)
      .select()
      .single()

    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapRoomAssignment(data)
  },
}
