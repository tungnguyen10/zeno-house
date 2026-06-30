export const AUDIT_ACTIONS = {
  // Building
  BUILDING_CREATED: 'building.created',
  BUILDING_UPDATED: 'building.updated',
  BUILDING_ARCHIVED: 'building.archived',
  BUILDING_ACTIVATED: 'building.activated',
  BUILDING_REMOVED: 'building.removed',

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

  // Contract
  CONTRACT_CREATED: 'contract.created',
  CONTRACT_UPDATED: 'contract.updated',
  CONTRACT_TERMINATED: 'contract.terminated',
  CONTRACT_EXPIRED: 'contract.expired',
  CONTRACT_RENEWED: 'contract.renewed',
  CONTRACT_REMOVED: 'contract.removed',

  // Services
  BUILDING_SERVICE_REMOVED: 'building_service.removed',
  CONTRACT_SERVICE_REMOVED: 'contract_service.removed',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

export type AuditEntityType =
  | 'building'
  | 'room'
  | 'tenant'
  | 'contract'
  | 'contract_renewal'
  | 'building_service'
  | 'contract_service'
  | 'meter_device'
