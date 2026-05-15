import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { DashboardSummary, BuildingRoomStats } from '~/types/dashboard'

function emptyRoomStats(): BuildingRoomStats {
  return { total: 0, available: 0, occupied: 0, maintenance: 0 }
}

export const DashboardRepository = {
  async getSummary(event: H3Event): Promise<DashboardSummary> {
    const client = await serverSupabaseClient(event)

    const [
      buildingsResult,
      roomsResult,
      tenantsResult,
      contractsResult,
      buildingBreakdownResult,
    ] = await Promise.all([
      client.from('buildings').select('*', { count: 'exact', head: true }),
      client.from('rooms').select('id, status, building_id'),
      client.from('tenants').select('*', { count: 'exact', head: true }),
      client.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      client.from('buildings').select('id, name').order('name', { ascending: true }),
    ])

    if (buildingsResult.error) throw createError({ statusCode: 500, message: buildingsResult.error.message })
    if (roomsResult.error) throw createError({ statusCode: 500, message: roomsResult.error.message })
    if (tenantsResult.error) throw createError({ statusCode: 500, message: tenantsResult.error.message })
    if (contractsResult.error) throw createError({ statusCode: 500, message: contractsResult.error.message })
    if (buildingBreakdownResult.error) throw createError({ statusCode: 500, message: buildingBreakdownResult.error.message })

    const allRooms = roomsResult.data ?? []

    // Aggregate global room stats
    const roomStats: BuildingRoomStats = allRooms.reduce((acc, room) => {
      acc.total++
      if (room.status === 'available') acc.available++
      else if (room.status === 'occupied') acc.occupied++
      else if (room.status === 'maintenance') acc.maintenance++
      return acc
    }, emptyRoomStats())

    // Aggregate per-building room stats
    const roomsByBuilding = new Map<string, BuildingRoomStats>()
    for (const room of allRooms) {
      if (!roomsByBuilding.has(room.building_id)) {
        roomsByBuilding.set(room.building_id, emptyRoomStats())
      }
      const stats = roomsByBuilding.get(room.building_id)!
      stats.total++
      if (room.status === 'available') stats.available++
      else if (room.status === 'occupied') stats.occupied++
      else if (room.status === 'maintenance') stats.maintenance++
    }

    const buildings = buildingBreakdownResult.data ?? []
    const buildingBreakdown = buildings.map((b) => ({
      id: b.id,
      name: b.name,
      rooms: roomsByBuilding.get(b.id) ?? emptyRoomStats(),
    }))

    return {
      buildings: { total: buildingsResult.count ?? 0 },
      rooms: roomStats,
      tenants: { total: tenantsResult.count ?? 0 },
      contracts: { active: contractsResult.count ?? 0 },
      buildingBreakdown,
    }
  },
}
