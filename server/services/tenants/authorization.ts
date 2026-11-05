import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { Tenant } from '~/types/tenants'
import { TenantRepository, type TenantAccessFacts } from '../../repositories/tenants'
import { getAssignedBuildingIds } from '../../utils/scope'

export type TenantAccessLevel = 'full' | 'basic' | 'none'
export type TenantAction = 'read_profile' | 'update_profile' | 'manage_documents' | 'archive' | 'activate' | 'delete' | 'manage_account'
export interface TenantAccessContext extends TenantAccessFacts { tenant: Tenant; level: TenantAccessLevel }
const sorted = (ids: string[]) => [...new Set(ids)].sort()

export const TenantAuthorizationService = {
  async resolveTenants(event: H3Event, user: AuthUser, tenants: Tenant[]): Promise<Map<string, TenantAccessContext>> {
    if (!tenants.length) return new Map()
    const [facts, scope, created] = await Promise.all([
      TenantRepository.findAccessFacts(event, tenants.map(tenant => tenant.id)),
      getAssignedBuildingIds(event, user),
      user.app_metadata.role === 'admin' ? Promise.resolve([]) : TenantRepository.findCreatedTenantIdsByActor(event, user.id),
    ])
    const creators = new Set(created)
    const result = new Map<string, TenantAccessContext>()
    for (const tenant of tenants) {
      const fact = facts.get(tenant.id)
      let level: TenantAccessLevel = 'none'
      if (fact) {
        if (user.app_metadata.role === 'admin') level = 'full'
        else if (scope) {
          const hasScope = [...fact.activeBuildingIds, ...fact.historicalBuildingIds].some(id => scope.includes(id))
          if (fact.activeBuildingIds.length) {
            if (fact.activeBuildingIds.every(id => scope.includes(id))) level = 'full'
            else if (hasScope) level = 'basic'
          }
          else if (fact.everContracted) level = hasScope ? 'basic' : 'none'
          else if (creators.has(tenant.id)) level = 'full'
        }
      }
      result.set(tenant.id, {
        tenant, level,
        activeBuildingIds: sorted(fact?.activeBuildingIds ?? []),
        historicalBuildingIds: sorted(fact?.historicalBuildingIds ?? []),
        everContracted: fact?.everContracted ?? true,
      })
    }
    return result
  },
  async resolveAccess(event: H3Event, user: AuthUser, identifier: string): Promise<TenantAccessContext | null> {
    const tenant = await TenantRepository.findByIdentifier(event, identifier)
    if (!tenant) return null
    return (await this.resolveTenants(event, user, [tenant])).get(tenant.id) ?? null
  },
  async resolveAccessMany(event: H3Event, user: AuthUser, ids: string[]): Promise<Map<string, TenantAccessContext>> {
    return this.resolveTenants(event, user, await TenantRepository.findByIds(event, [...new Set(ids)]))
  },
  async assertAccess(event: H3Event, user: AuthUser, identifier: string, action: TenantAction): Promise<TenantAccessContext> {
    // Managers retain their existing per-building deletion grant. The read
    // capability gates identifier resolution; deletion grants are checked below
    // by the caller against every server-owned building.
    const capability = action === 'manage_account' ? 'tenant.account.provision'
      : action === 'read_profile' || action === 'delete' ? 'tenants.read' : 'tenants.update'
    requireCapability(user, capability, 'Không có quyền thao tác với khách thuê')
    const context = await this.resolveAccess(event, user, identifier)
    if (!context || context.level === 'none') throwNotFound('Không tìm thấy khách thuê')
    if (action !== 'read_profile' && context.level !== 'full') throwForbidden('Chỉ có quyền xem thông tin cơ bản của khách thuê')
    return context
  },
}
