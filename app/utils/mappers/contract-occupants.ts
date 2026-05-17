import type { Tables } from '~/types/database.types'
import type { ContractOccupant } from '~/types/contract-occupants'

type OccupantRow = Tables<'contract_occupants'> & {
  tenants?: { full_name: string; phone: string | null } | null
}

export function mapContractOccupant(row: OccupantRow): ContractOccupant {
  return {
    id: row.id,
    contractId: row.contract_id,
    tenantId: row.tenant_id,
    tenantName: row.tenants?.full_name ?? null,
    tenantPhone: row.tenants?.phone ?? null,
    role: row.role as 'primary' | 'roommate',
    moveInDate: row.move_in_date,
    moveOutDate: row.move_out_date,
    billingCounted: row.billing_counted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
