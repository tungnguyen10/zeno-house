import type { ServiceCatalogItem } from '~/types/service-catalog'

export interface ContractService {
  id: string
  contractId: string
  catalogId: string
  catalog: ServiceCatalogItem
  amount: number
  quantity: number
  isEnabled: boolean
  notes: string | null
}
