export const ROLES = {
  ADMIN: 'admin',
  OWNER: 'owner',
  MANAGER: 'manager',
  TENANT: 'tenant',
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

/** Roles that can be created through the app. Admin is never app-creatable. */
export const CREATABLE_ROLES = [ROLES.OWNER, ROLES.MANAGER] as const

export type CreatableRole = (typeof CREATABLE_ROLES)[number]
