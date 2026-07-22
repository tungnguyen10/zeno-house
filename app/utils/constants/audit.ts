export const AUDIT_ACTIONS = {
  // Building
  BUILDING_CREATED: 'building.created',
  BUILDING_UPDATED: 'building.updated',
  BUILDING_ARCHIVED: 'building.archived',
  BUILDING_ACTIVATED: 'building.activated',
  BUILDING_REMOVED: 'building.removed',
  BUILDING_INVOICE_PROFILE_UPDATED: 'building.invoice_profile.updated',

  // Room
  ROOM_CREATED: 'room.created',
  ROOM_UPDATED: 'room.updated',
  ROOM_ARCHIVED: 'room.archived',
  ROOM_ACTIVATED: 'room.activated',
  ROOM_MAINTENANCE_SET: 'room.maintenance_set',
  ROOM_REMOVED: 'room.removed',

  // Tenant
  TENANT_CREATED: 'tenant.created',
  TENANT_UPDATED: 'tenant.updated',
  TENANT_ARCHIVED: 'tenant.archived',
  TENANT_REMOVED: 'tenant.removed',

  // Tenant portal account provisioning
  TENANT_ACCOUNT_PROVISIONED: 'tenant.account.provisioned',
  TENANT_ACCOUNT_DISABLED: 'tenant.account.disabled',
  TENANT_ACCOUNT_ENABLED: 'tenant.account.enabled',
  TENANT_ACCOUNT_PASSWORD_RESET: 'tenant.account.password_reset',
  TENANT_ACCOUNT_REVOKED: 'tenant.account.revoked',
  TENANT_ACCOUNT_PASSWORD_CHANGED: 'tenant.account.password_changed',
  SUPPORT_REQUEST_CREATED: 'support_request.created',

  // Contract
  CONTRACT_CREATED: 'contract.created',
  CONTRACT_UPDATED: 'contract.updated',
  CONTRACT_TERMINATED: 'contract.terminated',
  CONTRACT_EXPIRED: 'contract.expired',
  CONTRACT_RENEWED: 'contract.renewed',
  CONTRACT_REMOVED: 'contract.removed',
  CONTRACT_OCCUPANT_ADDED: 'contract_occupant.added',
  CONTRACT_OCCUPANT_MOVED_OUT: 'contract_occupant.moved_out',
  CONTRACT_OCCUPANT_REMOVED: 'contract_occupant.removed',
  CONTRACT_PAYMENT_CREATED: 'contract_payment.created',
  CONTRACT_PAYMENT_UPDATED: 'contract_payment.updated',
  CONTRACT_PAYMENT_REMOVED: 'contract_payment.removed',

  // Services
  BUILDING_SERVICE_REMOVED: 'building_service.removed',
  BUILDING_SERVICE_CREATED: 'building_service.created',
  BUILDING_SERVICE_UPDATED: 'building_service.updated',
  CONTRACT_SERVICE_REMOVED: 'contract_service.removed',
  CONTRACT_SERVICE_CREATED: 'contract_service.created',
  CONTRACT_SERVICE_UPDATED: 'contract_service.updated',
  CONTRACT_SERVICE_SYNCED: 'contract_service.synced',
  SERVICE_CATALOG_ITEM_CREATED: 'service_catalog_item.created',

  // Operations report — expenses
  BUILDING_EXPENSE_CREATED: 'building_expense.created',
  BUILDING_EXPENSE_UPDATED: 'building_expense.updated',
  BUILDING_EXPENSE_VOIDED: 'building_expense.voided',
  BUILDING_EXPENSE_RECEIPT_ATTACHED: 'building_expense.receipt_attached',
  BUILDING_EXPENSE_RECEIPT_REMOVED: 'building_expense.receipt_removed',

  // Operations report — shared expenses
  SHARED_EXPENSE_CREATED: 'shared_expense.created',
  SHARED_EXPENSE_UPDATED: 'shared_expense.updated',
  SHARED_EXPENSE_DEACTIVATED: 'shared_expense.deactivated',
  SHARED_EXPENSE_ALLOCATED: 'shared_expense.allocated',

  // Operations report — reserve fund and period lifecycle
  RESERVE_FUND_RATE_CREATED: 'reserve_fund_rate.created',
  RESERVE_FUND_RATE_UPDATED: 'reserve_fund_rate.updated',
  RESERVE_FUND_ACCRUAL_REFRESHED: 'reserve_fund.accrual_refreshed',
  OPERATIONS_REPORT_PERIOD_CLOSED: 'operations_report_period.closed',
  OPERATIONS_REPORT_PERIOD_AUTO_CLOSED: 'operations_report_period.auto_closed',
  OPERATIONS_REPORT_PERIOD_REOPENED: 'operations_report_period.reopened',

  // Operations report — fixed costs
  BUILDING_FIXED_COST_CREATED: 'building_fixed_cost.created',
  BUILDING_FIXED_COST_UPDATED: 'building_fixed_cost.updated',
  BUILDING_FIXED_COST_ENDED: 'building_fixed_cost.ended',

  // Operations report — recurring expenses
  RECURRING_EXPENSE_CREATED: 'recurring_expense.created',
  RECURRING_EXPENSE_UPDATED: 'recurring_expense.updated',
  RECURRING_EXPENSE_DELETED: 'recurring_expense.deleted',
  RECURRING_EXPENSE_RECORDED: 'recurring_expense.recorded',
  RECURRING_EXPENSE_DISMISSED: 'recurring_expense.dismissed',

  // Operations report — prepaid expenses
  PREPAID_EXPENSE_CREATED: 'prepaid_expense.created',
  PREPAID_EXPENSE_UPDATED: 'prepaid_expense.updated',
  PREPAID_EXPENSE_DELETED: 'prepaid_expense.deleted',

  // User / role management
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_ROLE_CHANGED: 'user.role_changed',
  USER_REMOVED: 'user.removed',
  USER_ASSIGNMENT_ADDED: 'user.assignment_added',
  USER_ASSIGNMENT_UPDATED: 'user.assignment_updated',
  USER_ASSIGNMENT_REMOVED: 'user.assignment_removed',
  USER_ACCESS_REQUEST_CREATED: 'user.access_request.created',
  USER_ACCESS_REQUEST_APPROVED: 'user.access_request.approved',
  USER_ACCESS_REQUEST_REJECTED: 'user.access_request.rejected',

  // Tenant portal
  TENANT_PROFILE_UPDATED: 'tenant.profile_updated',
  TENANT_DOCUMENT_UPLOADED: 'tenant_document.uploaded',
  TENANT_DOCUMENT_REMOVED: 'tenant_document.removed',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

export const AUDIT_ENTITY_TYPES = [
  'building',
  'room',
  'tenant',
  'contract',
  'contract_renewal',
  'building_service',
  'contract_service',
  'meter_device',
  'user',
  'building_expense',
  'building_fixed_cost',
  'recurring_expense',
  'prepaid_expense',
  'support_request',
  'contract_occupant',
  'contract_payment',
  'service_catalog_item',
  'shared_expense',
  'reserve_fund',
  'reserve_fund_rate',
  'operations_report_period',
  'tenant_document',
] as const

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]
