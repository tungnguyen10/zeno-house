import type { AssignmentManager } from './assignments'
import type { BuildingService } from './building-services'
import type { BuildingInvoiceProfile } from './building-invoice-profile'
import type { BuildingInvoiceEmailSettings } from './invoice-email'
import type { Building } from './buildings'
import type { ContractService } from './contract-services'
import type { ContractWithDetails } from './contracts'
import type {
  BuildingFixedCost,
  BuildingReserveFundRate,
  PrepaidExpense,
  RecurringExpense,
} from './operations-report'
import type { ServiceCatalogItem } from './service-catalog'

export interface BuildingSettingsBootstrap {
  building: Building
  invoiceProfile: BuildingInvoiceProfile | null
  invoiceEmailAvailable: boolean
  invoiceEmailSettings: BuildingInvoiceEmailSettings | null
  buildingServices: BuildingService[]
  contractServices: ContractService[]
  catalog: ServiceCatalogItem[]
  contracts: ContractWithDetails[]
  managers: AssignmentManager[]
  fixedCosts: BuildingFixedCost[]
  reserveRates: BuildingReserveFundRate[]
  recurringExpenses: RecurringExpense[]
  prepaidExpenses: PrepaidExpense[]
}
