export type AuditDurability = 'transactional' | 'outbox' | 'operational'

export interface AuditMutationPolicy {
  routePrefix: string
  actionOwner: string
  durability: AuditDurability
}

// Every mutating API route must belong to one explicit domain policy. The CI
// contract test rejects new top-level mutation domains until their audit owner
// and durability strategy are declared here.
export const AUDIT_MUTATION_POLICIES: readonly AuditMutationPolicy[] = [
  { routePrefix: 'access-requests/', actionOwner: 'AccessRequestService', durability: 'outbox' },
  { routePrefix: 'ai/', actionOwner: 'AI operational telemetry', durability: 'operational' },
  { routePrefix: 'assignments/', actionOwner: 'AssignmentService', durability: 'transactional' },
  { routePrefix: 'auth/', actionOwner: 'AuthService', durability: 'outbox' },
  { routePrefix: 'billing/', actionOwner: 'Billing services/RPCs', durability: 'transactional' },
  { routePrefix: 'building-expenses/', actionOwner: 'BuildingExpenseService', durability: 'outbox' },
  { routePrefix: 'building-fixed-costs/', actionOwner: 'BuildingFixedCostService', durability: 'transactional' },
  { routePrefix: 'building-services/', actionOwner: 'BuildingServiceService', durability: 'transactional' },
  { routePrefix: 'buildings/', actionOwner: 'BuildingService', durability: 'transactional' },
  { routePrefix: 'contract-services/', actionOwner: 'ContractServiceService', durability: 'transactional' },
  { routePrefix: 'contracts/', actionOwner: 'Contract services', durability: 'transactional' },
  { routePrefix: 'internal/', actionOwner: 'Internal operation telemetry', durability: 'operational' },
  { routePrefix: 'meter-readings/', actionOwner: 'MeterReadingService', durability: 'transactional' },
  { routePrefix: 'operations-report/', actionOwner: 'OperationsReportService', durability: 'transactional' },
  { routePrefix: 'prepaid-expenses/', actionOwner: 'PrepaidExpenseService', durability: 'transactional' },
  { routePrefix: 'recurring-expenses/', actionOwner: 'RecurringExpenseService', durability: 'transactional' },
  { routePrefix: 'reserve-fund-rates/', actionOwner: 'ReserveFundRateService', durability: 'transactional' },
  { routePrefix: 'reserve-funds/', actionOwner: 'ReserveFundService', durability: 'transactional' },
  { routePrefix: 'rooms/', actionOwner: 'RoomService', durability: 'transactional' },
  { routePrefix: 'service-catalog/', actionOwner: 'ServiceCatalogService', durability: 'transactional' },
  { routePrefix: 'shared-expenses/', actionOwner: 'SharedExpenseService', durability: 'transactional' },
  { routePrefix: 'tenant-accounts/', actionOwner: 'TenantAccountService', durability: 'outbox' },
  { routePrefix: 'tenant/', actionOwner: 'Tenant portal services', durability: 'outbox' },
  { routePrefix: 'tenants/', actionOwner: 'TenantService', durability: 'outbox' },
  { routePrefix: 'users/', actionOwner: 'UserService', durability: 'outbox' },
  { routePrefix: 'webhooks/', actionOwner: 'Provider webhook telemetry', durability: 'operational' },
] as const
