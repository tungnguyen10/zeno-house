import type { H3Event } from 'h3'
import { randomBytes } from 'node:crypto'
import type { AuthUser } from '~/types/auth'
import type {
  TenantAccountCredentials,
  TenantAccountListItem,
  TenantAccountState,
} from '~/types/tenant-accounts'
import type {
  TenantAccountProvisionInput,
  TenantAccountStatusUpdateInput,
} from '~/utils/validators/tenant-accounts'
import { ROLES } from '~/utils/constants/roles'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import type { Tenant } from '~/types/tenants'
import { TenantAccountLinkRepository } from '../../repositories/tenant-portal/account-links'
import { UserRepository } from '../../repositories/users'
import { TenantRepository } from '../../repositories/tenants'
import { getAssignedBuildingIds } from '../../utils/scope'
import { AuditService } from '../audit'

const PROVISION_CAPABILITY = 'tenant.account.provision'

function assertCapability(actor: AuthUser): void {
  if (!can(actor, PROVISION_CAPABILITY)) {
    throwForbidden('Không có quyền cấp tài khoản người thuê')
  }
}

/** Strong, single-use temporary password (URL-safe, ~24 chars). */
function generateTempPassword(): string {
  return randomBytes(18).toString('base64url')
}

/**
 * Loads the tenant and enforces the actor's scope: admin is unscoped; owner may
 * only act on tenants with a contract in an assigned building or created by
 * them. Out-of-scope tenants resolve as not found (mirrors read-scope hiding).
 */
async function loadTenantInScope(
  event: H3Event,
  actor: AuthUser,
  tenantId: string,
): Promise<Tenant> {
  const tenant = await TenantRepository.findById(event, tenantId)
  if (!tenant) throwNotFound('Không tìm thấy người thuê')

  const buildingIds = await getAssignedBuildingIds(event, actor)
  if (buildingIds === null) return tenant // admin — unscoped

  const inScope
    = await TenantRepository.hasContractInBuildings(event, tenantId, buildingIds)
      || await TenantRepository.wasCreatedByActor(event, tenantId, actor.id)
  if (!inScope) throwNotFound('Không tìm thấy người thuê')
  return tenant
}

async function stateFromLink(
  event: H3Event,
  tenantId: string,
): Promise<TenantAccountState> {
  const link = await TenantAccountLinkRepository.getByTenantId(event, tenantId)
  if (!link) {
    return { tenantId, hasAccount: false, email: null, status: null, linkedAt: null }
  }
  const user = await UserRepository.getById(event, link.authUserId)
  return {
    tenantId,
    hasAccount: true,
    email: user?.email ?? null,
    status: link.status,
    linkedAt: link.createdAt,
  }
}

export const TenantAccountService = {
  async getStatus(event: H3Event, actor: AuthUser, tenantId: string): Promise<TenantAccountState> {
    assertCapability(actor)
    await loadTenantInScope(event, actor, tenantId)
    return stateFromLink(event, tenantId)
  },

  async list(event: H3Event, actor: AuthUser): Promise<TenantAccountListItem[]> {
    assertCapability(actor)
    const links = await TenantAccountLinkRepository.listAll(event)
    if (links.length === 0) return []

    // Scope: admin sees all; owner sees tenants in assigned buildings or created
    // by them. Resolve the allowed set with two bulk queries (no per-item calls).
    const buildingIds = await getAssignedBuildingIds(event, actor)
    let allowed: Set<string> | null = null
    if (buildingIds !== null) {
      const [scopedIds, createdIds] = await Promise.all([
        TenantRepository.findTenantIdsForBuildings(event, buildingIds),
        TenantRepository.findCreatedTenantIdsByActor(event, actor.id),
      ])
      allowed = new Set([...scopedIds, ...createdIds])
    }

    const scopedLinks = allowed === null ? links : links.filter(link => allowed.has(link.tenantId))
    if (scopedLinks.length === 0) return []

    // Bulk-load tenant records and tenant-role auth users once, then join.
    const [tenants, users] = await Promise.all([
      TenantRepository.findByIds(event, scopedLinks.map(link => link.tenantId)),
      UserRepository.listByRoles(event, [ROLES.TENANT]),
    ])
    const tenantMap = new Map(tenants.map(tenant => [tenant.id, tenant]))
    const emailMap = new Map(users.map(user => [user.id, user.email]))

    const items: TenantAccountListItem[] = []
    for (const link of scopedLinks) {
      const tenant = tenantMap.get(link.tenantId)
      if (!tenant) continue
      items.push({
        tenantId: tenant.id,
        tenantCode: tenant.code,
        tenantName: tenant.fullName,
        email: emailMap.get(link.authUserId) ?? null,
        status: link.status,
        linkedAt: link.createdAt,
      })
    }
    return items
  },

  async provision(
    event: H3Event,
    actor: AuthUser,
    tenantId: string,
    input: TenantAccountProvisionInput,
  ): Promise<TenantAccountCredentials> {
    assertCapability(actor)
    const tenant = await loadTenantInScope(event, actor, tenantId)

    const existing = await TenantAccountLinkRepository.getByTenantId(event, tenantId)
    if (existing) throwConflict('Người thuê này đã có tài khoản')

    const tempPassword = generateTempPassword()
    const authUser = await UserRepository.create(event, {
      email: input.email,
      password: tempPassword,
      full_name: tenant.fullName,
      role: ROLES.TENANT,
      created_by: actor.id,
      tenant_onboarding: 'password_required',
    })

    try {
      await TenantAccountLinkRepository.create(event, { authUserId: authUser.id, tenantId })
    }
    catch (error) {
      // Compensate: avoid an orphaned tenant-role auth user with no link.
      await UserRepository.remove(event, authUser.id).catch(() => undefined)
      throw error
    }

    await AuditService.append(event, actor, {
      building_id: null,
      action: AUDIT_ACTIONS.TENANT_ACCOUNT_PROVISIONED,
      entity_type: 'tenant',
      entity_id: tenantId,
      metadata: { email: input.email },
    })

    return { email: input.email, tempPassword }
  },

  async setStatus(
    event: H3Event,
    actor: AuthUser,
    tenantId: string,
    input: TenantAccountStatusUpdateInput,
  ): Promise<TenantAccountState> {
    assertCapability(actor)
    await loadTenantInScope(event, actor, tenantId)

    const link = await TenantAccountLinkRepository.getByTenantId(event, tenantId)
    if (!link) throwNotFound('Không tìm thấy tài khoản người thuê')

    const updated = await TenantAccountLinkRepository.updateStatus(event, tenantId, input.status)
    await AuditService.append(event, actor, {
      building_id: null,
      action: input.status === 'disabled'
        ? AUDIT_ACTIONS.TENANT_ACCOUNT_DISABLED
        : AUDIT_ACTIONS.TENANT_ACCOUNT_ENABLED,
      entity_type: 'tenant',
      entity_id: tenantId,
    })

    const user = await UserRepository.getById(event, link.authUserId)
    return {
      tenantId,
      hasAccount: true,
      email: user?.email ?? null,
      status: updated.status,
      linkedAt: updated.createdAt,
    }
  },

  async resetPassword(
    event: H3Event,
    actor: AuthUser,
    tenantId: string,
  ): Promise<TenantAccountCredentials> {
    assertCapability(actor)
    await loadTenantInScope(event, actor, tenantId)

    const link = await TenantAccountLinkRepository.getByTenantId(event, tenantId)
    if (!link) throwNotFound('Không tìm thấy tài khoản người thuê')

    const tempPassword = generateTempPassword()
    const updated = await UserRepository.update(event, link.authUserId, { password: tempPassword })
    await UserRepository.setTenantOnboardingStage(event, link.authUserId, 'password_required')

    await AuditService.append(event, actor, {
      building_id: null,
      action: AUDIT_ACTIONS.TENANT_ACCOUNT_PASSWORD_RESET,
      entity_type: 'tenant',
      entity_id: tenantId,
    })

    return { email: updated.email ?? '', tempPassword }
  },

  async revoke(event: H3Event, actor: AuthUser, tenantId: string): Promise<void> {
    assertCapability(actor)
    await loadTenantInScope(event, actor, tenantId)

    const link = await TenantAccountLinkRepository.getByTenantId(event, tenantId)
    if (!link) throwNotFound('Không tìm thấy tài khoản người thuê')

    // Deleting the auth user cascades the tenant_user_links row and invalidates
    // sessions, freeing the email for re-provisioning.
    await UserRepository.remove(event, link.authUserId)
    await TenantAccountLinkRepository.deleteByTenantId(event, tenantId).catch(() => undefined)

    await AuditService.append(event, actor, {
      building_id: null,
      action: AUDIT_ACTIONS.TENANT_ACCOUNT_REVOKED,
      entity_type: 'tenant',
      entity_id: tenantId,
    })
  },
}
