import type { Tables } from '~/types/database.types'
import type { ContractService } from '~/types/contract-services'
import { mapServiceCatalog } from '~/utils/mappers/service-catalog'

type ContractServiceRow = Tables<'contract_services'> & {
  service_catalog: Tables<'service_catalog'>
}

export function mapContractService(row: ContractServiceRow): ContractService {
  return {
    id: row.id,
    contractId: row.contract_id,
    catalogId: row.catalog_id,
    catalog: mapServiceCatalog(row.service_catalog),
    amount: row.amount,
    quantity: row.quantity,
    isEnabled: row.is_enabled,
    notes: row.notes,
  }
}
