import type { H3Event } from 'h3'
import { db } from '../../utils/db'

export type TenantLinkStatus = 'active' | 'disabled'

export interface TenantLinkRow {
  id: string
  authUserId: string
  tenantId: string
  status: TenantLinkStatus
  createdAt: string
}

interface TenantLinkDbRow {
  id: string
  auth_user_id: string
  tenant_id: string
  status: TenantLinkStatus
  created_at: string
}

function mapRow(row: TenantLinkDbRow): TenantLinkRow {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    tenantId: row.tenant_id,
    status: row.status,
    createdAt: row.created_at,
  }
}

const COLUMNS = 'id, auth_user_id, tenant_id, status, created_at'

/**
 * Write/read helpers for `tenant_user_links`, used by the operator-facing
 * account provisioning flow. Runs through the service-role client; the service
 * layer enforces the capability and owner building scope.
 */
export const TenantAccountLinkRepository = {
  async getByTenantId(event: H3Event, tenantId: string): Promise<TenantLinkRow | null> {
    const { data, error } = await db(event)
      .from('tenant_user_links')
      .select(COLUMNS)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) throwDbError(error, 'tenantPortal.accountLinks.getByTenantId')
    return data ? mapRow(data as TenantLinkDbRow) : null
  },

  async listByTenantIds(event: H3Event, tenantIds: string[]): Promise<TenantLinkRow[]> {
    if (tenantIds.length === 0) return []
    const { data, error } = await db(event)
      .from('tenant_user_links')
      .select(COLUMNS)
      .in('tenant_id', tenantIds)

    if (error) throwDbError(error, 'tenantPortal.accountLinks.listByTenantIds')
    return (data ?? []).map(row => mapRow(row as TenantLinkDbRow))
  },

  async listAll(event: H3Event): Promise<TenantLinkRow[]> {
    const { data, error } = await db(event)
      .from('tenant_user_links')
      .select(COLUMNS)
      .order('created_at', { ascending: false })

    if (error) throwDbError(error, 'tenantPortal.accountLinks.listAll')
    return (data ?? []).map(row => mapRow(row as TenantLinkDbRow))
  },

  async create(
    event: H3Event,
    input: { authUserId: string; tenantId: string },
  ): Promise<TenantLinkRow> {
    const { data, error } = await db(event)
      .from('tenant_user_links')
      .insert({ auth_user_id: input.authUserId, tenant_id: input.tenantId, status: 'active' })
      .select(COLUMNS)
      .single()

    if (error) {
      // unique(tenant_id) / unique(auth_user_id) violation.
      if (error.code === '23505') throwConflict('Người thuê hoặc email này đã có tài khoản')
      throwDbError(error, 'tenantPortal.accountLinks.create')
    }
    return mapRow(data as TenantLinkDbRow)
  },

  async updateStatus(
    event: H3Event,
    tenantId: string,
    status: TenantLinkStatus,
  ): Promise<TenantLinkRow> {
    const { data, error } = await db(event)
      .from('tenant_user_links')
      .update({ status })
      .eq('tenant_id', tenantId)
      .select(COLUMNS)
      .single()

    if (error) {
      if (error.code === 'PGRST116') throwNotFound('Không tìm thấy tài khoản người thuê')
      throwDbError(error, 'tenantPortal.accountLinks.updateStatus')
    }
    return mapRow(data as TenantLinkDbRow)
  },

  async deleteByTenantId(event: H3Event, tenantId: string): Promise<void> {
    const { error } = await db(event)
      .from('tenant_user_links')
      .delete()
      .eq('tenant_id', tenantId)

    if (error) throwDbError(error, 'tenantPortal.accountLinks.deleteByTenantId')
  },
}
