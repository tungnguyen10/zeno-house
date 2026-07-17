export type TenantAccountStatus = 'active' | 'disabled'

/** Whether a tenant record has a portal login, and its current link state. */
export interface TenantAccountState {
  tenantId: string
  hasAccount: boolean
  email: string | null
  status: TenantAccountStatus | null
  linkedAt: string | null
}

/** One-time credentials returned by provision/reset — never persisted or re-fetched. */
export interface TenantAccountCredentials {
  email: string
  tempPassword: string
}

/** A provisioned tenant account row for the Settings management list. */
export interface TenantAccountListItem {
  tenantId: string
  tenantCode: string
  tenantName: string
  email: string | null
  status: TenantAccountStatus
  linkedAt: string
}
