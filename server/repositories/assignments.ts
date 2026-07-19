import { db as serverSupabaseClient } from '../utils/db'
import type { H3Event } from 'h3'
import type {
  AssignmentBuilding,
  AssignmentCreatePayload,
  AssignmentManager,
  AssignmentUpdatePayload,
  AssignmentWithBuilding,
  ManagerAssignment,
  UserBuildingAssignment,
} from '~/types/assignments'
import type { Database } from '~/types/database.types'

type AssignmentRow = Database['public']['Tables']['user_building_assignments']['Row']

function mapAssignment(row: AssignmentRow): UserBuildingAssignment {
  return {
    id: row.id,
    user_id: row.user_id,
    building_id: row.building_id,
    approval_claim_token: row.approval_claim_token,
    can_delete_master_data: row.can_delete_master_data,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function userName(user: { user_metadata?: Record<string, unknown> | null }): string | null {
  const metadata = user.user_metadata ?? {}
  const value = metadata.full_name ?? metadata.name ?? metadata.display_name
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function listManagers(event: H3Event): Promise<AssignmentManager[]> {
  const client = serverSupabaseClient(event)
  const managers: AssignmentManager[] = []
  let page = 1

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throwDbError(error, 'assignments.listManagers')

    for (const user of data.users) {
      if (user.app_metadata?.role !== 'manager') continue
      managers.push({
        id: user.id,
        email: user.email ?? null,
        name: userName(user),
      })
    }

    if (data.users.length < 100) break
    page++
  }

  return managers
}

export const AssignmentRepository = {
  async findBuildingIdsByUser(event: H3Event, userId: string): Promise<string[]> {
    // Scope resolution is server-authoritative: service layer passes the
    // authenticated actor id, so we can read via service-role without relying
    // on table RLS policy state.
    const client = serverSupabaseClient(event)
    const { data, error } = await client
      .from('user_building_assignments')
      .select('building_id')
      .eq('user_id', userId)

    if (error) throwDbError(error, 'assignments.findBuildingIdsByUser')
    return (data ?? []).map(row => row.building_id)
  },

  async findByUserAndBuilding(
    event: H3Event,
    userId: string,
    buildingId: string,
  ): Promise<UserBuildingAssignment | null> {
    const client = await serverSupabaseClient<Database>(event)
    const { data, error } = await client
      .from('user_building_assignments')
      .select('*')
      .eq('user_id', userId)
      .eq('building_id', buildingId)
      .maybeSingle()

    if (error) throwDbError(error, 'assignments.findByUserAndBuilding')
    return data ? mapAssignment(data) : null
  },

  async findById(event: H3Event, id: string): Promise<UserBuildingAssignment | null> {
    const client = await serverSupabaseClient<Database>(event)
    const { data, error } = await client
      .from('user_building_assignments')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throwDbError(error, 'assignments.findById')
    return data ? mapAssignment(data) : null
  },

  async findAllWithBuildings(event: H3Event): Promise<ManagerAssignment[]> {
    const [managers, assignments] = await Promise.all([
      listManagers(event),
      AssignmentRepository.findAll(event),
    ])

    const byManager = new Map<string, AssignmentWithBuilding[]>()
    for (const assignment of assignments) {
      const items = byManager.get(assignment.user_id) ?? []
      items.push(assignment)
      byManager.set(assignment.user_id, items)
    }

    return managers.map(manager => ({
      manager,
      assignments: byManager.get(manager.id) ?? [],
    }))
  },

  async findManagersByBuilding(event: H3Event, buildingId: string): Promise<AssignmentManager[]> {
    const managers = await AssignmentRepository.findAllWithBuildings(event)
    return managers
      .filter(row => row.assignments.some(assignment => assignment.building_id === buildingId))
      .map(row => row.manager)
  },

  async findAll(event: H3Event, buildingIds?: string[] | null): Promise<AssignmentWithBuilding[]> {
    const client = await serverSupabaseClient<Database>(event)
    let query = client
      .from('user_building_assignments')
      .select('*, buildings(id, slug, code, name, address, status)')
      .order('created_at', { ascending: true })

    if (buildingIds) {
      if (buildingIds.length === 0) return []
      query = query.in('building_id', buildingIds)
    }

    const { data, error } = await query

    if (error) throwDbError(error, 'assignments.findAll')

    return (data ?? []).map((row) => {
      const building = row.buildings as AssignmentBuilding | null
      return {
        ...mapAssignment(row),
        building,
      }
    })
  },

  async findByUser(event: H3Event, userId: string): Promise<AssignmentWithBuilding[]> {
    const client = serverSupabaseClient(event)
    const { data, error } = await client
      .from('user_building_assignments')
      .select('*, buildings(id, slug, code, name, address, status)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) throwDbError(error, 'assignments.findByUser')

    return (data ?? []).map((row) => {
      const building = row.buildings as AssignmentBuilding | null
      return {
        ...mapAssignment(row),
        building,
      }
    })
  },

  async insert(
    event: H3Event,
    input: AssignmentCreatePayload & { created_by?: string | null; approval_claim_token?: string | null },
  ): Promise<UserBuildingAssignment> {
    // Mutations run through service-role; authorization is enforced in service
    // layer (manage capability + scope + target-role checks).
    const client = serverSupabaseClient(event)
    const { data, error } = await client
      .from('user_building_assignments')
      .insert({
        user_id: input.user_id,
        building_id: input.building_id,
        can_delete_master_data: false,
        created_by: input.created_by ?? null,
        approval_claim_token: input.approval_claim_token ?? null,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') throwConflict('Manager đã được gán vào tòa nhà này')
      throwDbError(error, 'assignments.insert')
    }
    return mapAssignment(data)
  },

  async removeByApprovalClaim(event: H3Event, approvalClaimToken: string): Promise<void> {
    const { error } = await serverSupabaseClient(event)
      .from('user_building_assignments')
      .delete()
      .eq('approval_claim_token', approvalClaimToken)

    if (error) throwDbError(error, 'assignments.removeByApprovalClaim')
  },

  async update(
    event: H3Event,
    id: string,
    input: AssignmentUpdatePayload,
  ): Promise<UserBuildingAssignment> {
    // Mutations run through service-role; authorization is enforced in service
    // layer (manage capability + scope + target-role checks).
    const client = serverSupabaseClient(event)
    const { data, error } = await client
      .from('user_building_assignments')
      .update({ can_delete_master_data: input.can_delete_master_data })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throwDbError(error, 'assignments.update')
    return mapAssignment(data)
  },

  async remove(event: H3Event, id: string): Promise<void> {
    // Mutations run through service-role; authorization is enforced in service
    // layer (manage capability + scope + target-role checks).
    const client = serverSupabaseClient(event)
    const { error } = await client
      .from('user_building_assignments')
      .delete()
      .eq('id', id)

    if (error) throwDbError(error, 'assignments.remove')
  },

  async findBuildingsWithoutManager(
    event: H3Event,
    buildingIds?: string[] | null,
  ): Promise<AssignmentBuilding[]> {
    const client = await serverSupabaseClient<Database>(event)
    let buildingQuery = client
      .from('buildings')
      .select('id, slug, code, name, address, status')
      .order('name')
    if (buildingIds) {
      if (buildingIds.length === 0) return []
      buildingQuery = buildingQuery.in('id', buildingIds)
    }
    const [{ data: buildings, error: buildingError }, { data: assignments, error: assignmentError }] = await Promise.all([
      buildingQuery,
      client.from('user_building_assignments').select('building_id'),
    ])

    if (buildingError) throwDbError(buildingError, 'assignments.findBuildingsWithoutManager.buildings')
    if (assignmentError) throwDbError(assignmentError, 'assignments.findBuildingsWithoutManager.assignments')

    const assigned = new Set((assignments ?? []).map(row => row.building_id))
    return (buildings ?? []).filter(building => !assigned.has(building.id))
  },
}
