import type { H3Event } from 'h3'
import type { TenantContractSummary } from '~/types/tenant-portal'
import { mapTenantContractSummary } from '~/utils/mappers/tenant-portal'
import { db } from '../../utils/db'

export interface TenantHousingContext {
  contractId: string
  buildingId: string
  primaryTenantId: string
  assignmentRole: 'primary' | 'roommate'
  primaryTenantName: string | null
  contract: TenantContractSummary
}

interface ContractRow {
  id: string
  tenant_id: string
  building_id: string
  contract_code: string
  start_date: string
  end_date: string
  monthly_rent: number
  deposit: number
  status: string
  tenants: { full_name: string | null } | Array<{ full_name: string | null }> | null
  rooms: {
    room_number: string | null
    buildings: { name: string | null } | Array<{ name: string | null }> | null
  } | Array<{
    room_number: string | null
    buildings: { name: string | null } | Array<{ name: string | null }> | null
  }> | null
}

interface OccupancyRow {
  contracts: ContractRow | ContractRow[] | null
}

const CONTRACT_SELECT = `
  id,
  tenant_id,
  building_id,
  contract_code,
  start_date,
  end_date,
  monthly_rent,
  deposit,
  status,
  tenants(full_name),
  rooms!inner(room_number, buildings!inner(name))
`

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function primaryName(row: ContractRow): string | null {
  return one(row.tenants)?.full_name ?? null
}

function contextFromContract(
  row: ContractRow,
  assignmentRole: TenantHousingContext['assignmentRole'],
): TenantHousingContext {
  const name = primaryName(row)
  return {
    contractId: row.id,
    buildingId: row.building_id,
    primaryTenantId: row.tenant_id,
    assignmentRole,
    primaryTenantName: name,
    contract: mapTenantContractSummary(row as never, assignmentRole, name),
  }
}

export const TenantHousingRepository = {
  async resolveActive(
    event: H3Event,
    tenantId: string,
    today: string,
  ): Promise<TenantHousingContext | null> {
    const { data: primary, error: primaryError } = await db(event)
      .from('contracts')
      .select(CONTRACT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (primaryError) throwDbError(primaryError, 'tenantPortal.housing.resolveActive.primary')
    if (primary) return contextFromContract(primary as unknown as ContractRow, 'primary')

    const { data: occupancy, error: occupancyError } = await db(event)
      .from('contract_occupants')
      .select(`contracts!inner(${CONTRACT_SELECT})`)
      .eq('tenant_id', tenantId)
      .lte('move_in_date', today)
      .is('move_out_date', null)
      .eq('contracts.status', 'active')
      .lte('contracts.start_date', today)
      .gte('contracts.end_date', today)
      .order('move_in_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (occupancyError) throwDbError(occupancyError, 'tenantPortal.housing.resolveActive.roommate')
    const contract = one((occupancy as unknown as OccupancyRow | null)?.contracts ?? null)
    return contract ? contextFromContract(contract, 'roommate') : null
  },
}
