import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BuildingSettingsBootstrap } from '~/types/building-settings'
import { AssignmentRepository } from '../../repositories/assignments'
import { BuildingServiceService } from '../building-services'
import { ContractServiceService } from '../contract-services'
import { ContractService } from '../contracts'
import { BuildingFixedCostService } from '../operations-report/fixed-costs'
import { PrepaidExpenseService } from '../operations-report/prepaid-expenses'
import { RecurringExpenseService } from '../operations-report/recurring-expenses'
import { ReserveFundService } from '../operations-report/reserve-funds'
import { ServiceCatalogService } from '../service-catalog'
import { BuildingService } from './index'
import { BuildingInvoiceProfileService } from './invoice-profile'

export const BuildingSettingsBootstrapService = {
  async get(
    event: H3Event,
    user: AuthUser,
    buildingIdentifier: string,
  ): Promise<BuildingSettingsBootstrap> {
    const building = await BuildingService.get(event, user, buildingIdentifier)
    const buildingId = building.id

    const [
      invoiceProfile,
      buildingServices,
      contractServices,
      catalog,
      contractResult,
      managers,
      fixedCosts,
      reserveRates,
      recurringExpenses,
      prepaidExpenses,
    ] = await Promise.all([
      can(user, 'building-invoice-profile.read')
        ? BuildingInvoiceProfileService.get(event, user, buildingId)
        : Promise.resolve(null),
      BuildingServiceService.list(event, user, buildingId),
      ContractServiceService.listByBuilding(event, user, buildingId),
      ServiceCatalogService.list(event, user, buildingId),
      ContractService.list(event, user, {
        page: 1,
        limit: 200,
        building_id: buildingId,
        status: ['active'],
      }),
      can(user, 'users.manage.global') || can(user, 'users.manage.scoped')
        ? AssignmentRepository.findManagersByBuilding(event, buildingId)
        : Promise.resolve([]),
      can(user, 'building-fixed-costs.read')
        ? BuildingFixedCostService.list(event, user, buildingId)
        : Promise.resolve([]),
      can(user, 'reserve-fund.read')
        ? ReserveFundService.listRates(event, user, buildingId)
        : Promise.resolve([]),
      can(user, 'recurring-expenses.read')
        ? RecurringExpenseService.list(event, user, { building_id: buildingId })
        : Promise.resolve([]),
      can(user, 'prepaid-expenses.read')
        ? PrepaidExpenseService.list(event, user, { building_id: buildingId })
        : Promise.resolve([]),
    ])

    return {
      building,
      invoiceProfile,
      buildingServices,
      contractServices,
      catalog,
      contracts: contractResult.items,
      managers,
      fixedCosts,
      reserveRates,
      recurringExpenses,
      prepaidExpenses,
    }
  },
}
