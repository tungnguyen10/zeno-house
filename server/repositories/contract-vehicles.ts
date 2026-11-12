import type { H3Event } from 'h3'
import { db } from '../utils/db'
import type { ContractVehicleRow } from '~/utils/mappers/contract-vehicles'
import type { ContractVehicleInput } from '~/utils/validators/contract-vehicles'

// Cast at the boundary until database.types.ts is regenerated after the cloud migration.
const from = (event: H3Event) => db(event).from('contract_vehicles' as never)
const COLUMNS = 'id, contract_id, owner_name, plate_number, vehicle_type, note, sort_order'

export const ContractVehicleRepository = {
  async list(event: H3Event, contractId: string): Promise<ContractVehicleRow[]> {
    const { data, error } = await from(event).select(COLUMNS).eq('contract_id', contractId).order('sort_order')
    if (error) throwDbError(error, 'contractVehicles.list')
    return (data ?? []) as ContractVehicleRow[]
  },

  async replace(event: H3Event, contractId: string, items: ContractVehicleInput[]): Promise<ContractVehicleRow[]> {
    const { error: delError } = await from(event).delete().eq('contract_id', contractId)
    if (delError) throwDbError(delError, 'contractVehicles.replace.delete')
    if (items.length === 0) return []
    const rows = items.map((item, index) => ({ contract_id: contractId, ...item, sort_order: index }))
    const { data, error } = await from(event).insert(rows as never).select(COLUMNS).order('sort_order')
    if (error) {
      if ((error as { code?: string }).code === '23505') throwConflict('Biển số xe bị trùng', { reason: 'CONTRACT_VEHICLE_DUPLICATE' })
      throwDbError(error, 'contractVehicles.replace.insert')
    }
    return (data ?? []) as ContractVehicleRow[]
  },
}
