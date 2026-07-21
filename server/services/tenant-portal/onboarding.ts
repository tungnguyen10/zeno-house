import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import { getTenantOnboardingStage, type TenantOnboardingStage } from '~/utils/tenant-onboarding'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { UserRepository } from '../../repositories/users'
import { TenantProfileRepository } from '../../repositories/tenant-portal/profile'
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
    await UserRepository.update(event, user.id, { password: input.password })
    await UserRepository.setTenantOnboardingStage(event, user.id, 'email_required')
    const tenantId = await resolveTenantId(event, user)
    await appendAudit(event, user, tenantId, AUDIT_ACTIONS.TENANT_ACCOUNT_PASSWORD_CHANGED)
  },

  async requestEmailChange(event: H3Event, user: AuthUser, input: { email: string }): Promise<void> {
    assertStage(user, 'email_required')
    await UserRepository.setTenantOnboardingEmail(event, user.id, input.email)
  },

  async confirmEmail(event: H3Event, user: AuthUser): Promise<void> {
    assertStage(user, 'email_required')
    const account = await UserRepository.getAuthAccount(event, user.id)
    if (!account?.email || !account.emailConfirmed || account.email !== account.tenantOnboardingEmail) {
      throwValidationError('Email mới chưa được xác minh')
    }

    const tenantId = await resolveTenantId(event, user)
    await TenantProfileRepository.updateLoginEmail(event, tenantId, account.email)
    await UserRepository.setTenantOnboardingStage(event, user.id, 'google_required')
    await appendAudit(event, user, tenantId, AUDIT_ACTIONS.TENANT_ACCOUNT_EMAIL_CONFIRMED)
  },

  async confirmGoogleLink(event: H3Event, user: AuthUser): Promise<void> {
    assertStage(user, 'google_required')
    const account = await UserRepository.getAuthAccount(event, user.id)
    const googleIdentity = account?.identities.find((identity) => {
      const email = identity.identityData.email
      return identity.provider === 'google'
        && typeof email === 'string'
        && email === account.email
        && identity.identityData.email_verified === true
    })
    if (!account?.email || !googleIdentity) {
      throwValidationError('Hãy đăng nhập Google bằng đúng email đã xác minh')
    }

    const tenantId = await resolveTenantId(event, user)
    await UserRepository.setTenantOnboardingStage(event, user.id, null)
    await UserRepository.setTenantOnboardingEmail(event, user.id, null)
    await appendAudit(event, user, tenantId, AUDIT_ACTIONS.TENANT_ACCOUNT_GOOGLE_LINKED)
  },
}
