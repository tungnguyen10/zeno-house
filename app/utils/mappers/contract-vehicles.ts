import type { ContractVehicle } from '~/types/contract-vehicles'

export interface ContractVehicleRow {
  id: string
  contract_id: string
  owner_name: string
  plate_number: string
  vehicle_type: string | null
  note: string | null
  sort_order: number
}

export function mapContractVehicle(row: ContractVehicleRow): ContractVehicle {
  return {
    id: row.id,
    ownerName: row.owner_name,
    plateNumber: row.plate_number,
    vehicleType: row.vehicle_type,
    note: row.note,
    sortOrder: row.sort_order,
  }
}
