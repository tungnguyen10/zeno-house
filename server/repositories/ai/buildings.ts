import type { H3Event } from 'h3'
import type { AiBuildingSummary } from '~/types/ai'
import { isUuid } from '~/utils/format/slug'
import { db } from '../../utils/db'

const SAFE_BUILDING_SELECT = 'id, slug, name, address, status, updated_at'

type BuildingReferenceRow = {
  id: string
  slug: string
  name: string
  address: string
  status: string
  updated_at: string
}

function mapSummary(row: BuildingReferenceRow): AiBuildingSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    address: row.address,
    status: row.status as AiBuildingSummary['status'],
    updatedAt: row.updated_at,
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

function applyScope<T extends { in: (column: string, values: string[]) => T }>(query: T, buildingIds: string[] | null): T {
  return buildingIds === null ? query : query.in('id', buildingIds)
}

export const AiBuildingRepository = {
  async listScoped(event: H3Event, buildingIds: string[] | null): Promise<AiBuildingSummary[]> {
    if (buildingIds?.length === 0) return []
    let query = db(event)
      .from('buildings')
      .select(SAFE_BUILDING_SELECT)
      .order('name', { ascending: true })
      .limit(100)
    query = applyScope(query, buildingIds)
    const { data, error } = await query
    if (error) throwDbError(error, 'ai.buildings.listScoped')
    return (data ?? []).map(row => mapSummary(row as BuildingReferenceRow))
  },

  async resolveScoped(
    event: H3Event,
    reference: string,
    buildingIds: string[] | null,
  ): Promise<AiBuildingSummary[]> {
    if (buildingIds?.length === 0) return []
    const value = reference.trim()
    if (!value) return []

    if (isUuid(value)) {
      let query = db(event).from('buildings').select(SAFE_BUILDING_SELECT).eq('id', value).limit(1)
      query = applyScope(query, buildingIds)
      const { data, error } = await query
      if (error) throwDbError(error, 'ai.buildings.resolveUuid')
      return (data ?? []).map(row => mapSummary(row as BuildingReferenceRow))
    }

    let slugQuery = db(event).from('buildings').select(SAFE_BUILDING_SELECT).eq('slug', value).limit(1)
    slugQuery = applyScope(slugQuery, buildingIds)
    const { data: slugRows, error: slugError } = await slugQuery
    if (slugError) throwDbError(slugError, 'ai.buildings.resolveSlug')
    if (slugRows?.[0]) return [mapSummary(slugRows[0] as BuildingReferenceRow)]

    let nameQuery = db(event)
      .from('buildings')
      .select(SAFE_BUILDING_SELECT)
      .ilike('name', escapeLike(value))
      .order('slug', { ascending: true })
      .limit(10)
    nameQuery = applyScope(nameQuery, buildingIds)
    const { data: nameRows, error: nameError } = await nameQuery
    if (nameError) throwDbError(nameError, 'ai.buildings.resolveName')
    return (nameRows ?? []).map(row => mapSummary(row as BuildingReferenceRow))
  },
}
