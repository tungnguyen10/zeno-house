import type { Tables } from '~/types/database.types'
import type { Contract, ContractStatus, ContractWithDetails } from '~/types/contracts'

export function mapContract(row: Tables<'contracts'>): Contract {
  return {
    id: row.id,
    roomId: row.room_id,
    tenantId: row.tenant_id,
    buildingId: row.building_id,
    startDate: row.start_date,
    endDate: row.end_date,
    monthlyRent: row.monthly_rent,
    deposit: row.deposit,
    paymentDay: row.payment_day ?? null,
    occupantCount: row.occupant_count,
    discountAmount: row.discount_amount,
    surchargeAmount: row.surcharge_amount,
    previousContractId: row.previous_contract_id,
    originalEndDate: row.original_end_date,
    renewalCount: row.renewal_count,
    status: row.status as ContractStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapContractWithDetails(row: Tables<'contracts'> & {
  rooms: { id: string; room_number: string; floor: number; building_id: string; buildings: { name: string } | null } | null
  tenants: { id: string; full_name: string; phone: string } | null
}): ContractWithDetails {
  return {
    ...mapContract(row),
    room: {
      id: row.rooms?.id ?? '',
      roomNumber: row.rooms?.room_number ?? '',
      floor: row.rooms?.floor ?? 0,
      buildingId: row.rooms?.building_id ?? '',
      buildingName: row.rooms?.buildings?.name ?? '',
    },
    tenant: {
      id: row.tenants?.id ?? '',
      fullName: row.tenants?.full_name ?? '',
      phone: row.tenants?.phone ?? '',
    },
  }
}
