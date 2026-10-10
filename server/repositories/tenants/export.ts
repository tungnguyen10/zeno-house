import type { H3Event } from 'h3'
import type { Tenant } from '~/types/tenants'
import { mapTenant } from '~/utils/mappers/tenants'
import { db } from '../../utils/db'

interface CurrentContract {
  id: string
  tenant_id: string
  room_id: string
  start_date: string
  room_number: string
}

interface CurrentOccupant {
  contract_id: string
  tenant_id: string
  move_in_date: string
  move_out_date: string | null
}

export interface TenantExportAssignment {
  tenantId: string
  roomNumbers: string[]
  roles: Array<'primary' | 'roommate'>
}

export function collectCurrentTenantAssignments(
  contracts: CurrentContract[],
  occupants: CurrentOccupant[],
  today: string,
): TenantExportAssignment[] {
  const result = new Map<string, TenantExportAssignment>()
  const currentContracts = contracts.filter(contract => contract.start_date <= today)
  const contractById = new Map(currentContracts.map(contract => [contract.id, contract]))

  function add(tenantId: string, roomNumber: string, role: 'primary' | 'roommate') {
    const row = result.get(tenantId) ?? { tenantId, roomNumbers: [], roles: [] }
    if (!row.roomNumbers.includes(roomNumber)) row.roomNumbers.push(roomNumber)
    if (!row.roles.includes(role)) row.roles.push(role)
    result.set(tenantId, row)
  }

  for (const contract of currentContracts) add(contract.tenant_id, contract.room_number, 'primary')
  for (const occupant of occupants) {
    const contract = contractById.get(occupant.contract_id)
    if (!contract || occupant.move_in_date > today || (occupant.move_out_date && occupant.move_out_date < today)) continue
    add(occupant.tenant_id, contract.room_number, 'roommate')
  }
  return [...result.values()]
}

const PAGE_SIZE = 500

export const TenantExportRepository = {
  async listCurrentAssignments(event: H3Event, buildingId: string, today: string): Promise<TenantExportAssignment[]> {
    const client = db(event)
    const contracts: CurrentContract[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client.from('contracts')
        .select('id,tenant_id,room_id,start_date,rooms(room_number)')
        .eq('building_id', buildingId)
        .eq('status', 'active')
        .lte('start_date', today)
        .order('id')
        .range(offset, offset + PAGE_SIZE - 1)
      if (error) throwDbError(error, 'tenants.export.contracts')
      for (const row of data ?? []) {
        const room = row.rooms as { room_number?: string | null } | null
        contracts.push({ id: row.id, tenant_id: row.tenant_id, room_id: row.room_id, start_date: row.start_date, room_number: room?.room_number ?? '' })
      }
      if ((data ?? []).length < PAGE_SIZE) break
    }

    const occupants: CurrentOccupant[] = []
    for (let start = 0; start < contracts.length; start += 200) {
      const contractIds = contracts.slice(start, start + 200).map(contract => contract.id)
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await client.from('contract_occupants')
          .select('contract_id,tenant_id,move_in_date,move_out_date')
          .in('contract_id', contractIds)
          .lte('move_in_date', today)
          .order('id')
          .range(offset, offset + PAGE_SIZE - 1)
        if (error) throwDbError(error, 'tenants.export.occupants')
        occupants.push(...(data ?? []))
        if ((data ?? []).length < PAGE_SIZE) break
      }
    }
    return collectCurrentTenantAssignments(contracts, occupants, today)
  },

  async findTenants(event: H3Event, ids: string[]): Promise<Tenant[]> {
    const client = db(event)
    const tenants: Tenant[] = []
    for (let start = 0; start < ids.length; start += 200) {
      const { data, error } = await client.from('tenants').select('*').in('id', ids.slice(start, start + 200))
      if (error) throwDbError(error, 'tenants.export.tenants')
      tenants.push(...(data ?? []).map(mapTenant))
    }
    return tenants
  },
}
