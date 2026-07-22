import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import { getTenantOnboardingStage, type TenantOnboardingStage } from '~/utils/tenant-onboarding'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { UserRepository } from '../../repositories/users'
import { ContractRepository } from '../../repositories/contracts'
import { resolveTenantId } from '../../utils/scope'
import { AuditService } from '../audit'

function assertStage(user: AuthUser, expected: TenantOnboardingStage): void {
  if (getTenantOnboardingStage(user) !== expected) {
    throwForbidden('Bước thiết lập tài khoản không hợp lệ')
  }
}

async function appendAudit(event: H3Event, user: AuthUser, tenantId: string, action: string): Promise<void> {
  const contract = await ContractRepository.findActiveByTenantId(event, tenantId)
  await AuditService.append(event, user, {
    building_id: contract?.buildingId ?? null,
    action,
    entity_type: 'tenant',
    entity_id: tenantId,
  })
}

export const TenantOnboardingService = {
  async setPassword(event: H3Event, user: AuthUser, input: { password: string }): Promise<void> {
    assertStage(user, 'password_required')
    await UserRepository.updateCurrentPassword(event, input.password)
    await UserRepository.setTenantOnboardingStage(event, user.id, null)
    const tenantId = await resolveTenantId(event, user)
    await appendAudit(event, user, tenantId, AUDIT_ACTIONS.TENANT_ACCOUNT_PASSWORD_CHANGED)
  },
}
