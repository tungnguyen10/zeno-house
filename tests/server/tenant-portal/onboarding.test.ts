import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const userRepo = vi.hoisted(() => ({
  updateCurrentPassword: vi.fn(),
  setTenantOnboardingStage: vi.fn(),
}))
const contractRepo = vi.hoisted(() => ({ findActiveByTenantId: vi.fn() }))
const scope = vi.hoisted(() => ({ resolveTenantId: vi.fn() }))
const auditService = vi.hoisted(() => ({ append: vi.fn() }))
const auth = vi.hoisted(() => ({ requireAuth: vi.fn() }))

vi.mock('../../../server/repositories/users', () => ({ UserRepository: userRepo }))
vi.mock('../../../server/repositories/contracts', () => ({ ContractRepository: contractRepo }))
vi.mock('../../../server/utils/scope', () => scope)
vi.mock('../../../server/services/audit', () => ({ AuditService: auditService }))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', auth.requireAuth)
vi.stubGlobal('parseBody', async (event: { context: { body?: unknown } }) => event.context.body)

function event(body?: unknown) {
  return { context: { body } } as never
}

function tenant(): AuthUser {
  return { id: 'auth-1', app_metadata: { role: 'tenant', tenant_onboarding: 'password_required' } } as AuthUser
}

async function service() {
  return (await import('../../../server/services/tenant-portal/onboarding')).TenantOnboardingService
}

beforeEach(() => {
  vi.clearAllMocks()
  scope.resolveTenantId.mockResolvedValue('tenant-1')
  contractRepo.findActiveByTenantId.mockResolvedValue({ buildingId: 'building-1' })
  userRepo.updateCurrentPassword.mockResolvedValue(undefined)
  userRepo.setTenantOnboardingStage.mockResolvedValue(undefined)
  auditService.append.mockResolvedValue(undefined)
  auth.requireAuth.mockResolvedValue(tenant())
})

describe('TenantOnboardingService', () => {
  it('changes the password through the tenant session and completes onboarding', async () => {
    await (await service()).setPassword(event(), tenant(), { password: 'new-password-123' })

    expect(userRepo.updateCurrentPassword).toHaveBeenCalledWith(expect.anything(), 'new-password-123')
    expect(userRepo.setTenantOnboardingStage).toHaveBeenCalledWith(expect.anything(), 'auth-1', null)
  })

  it('exposes no email or Google onboarding operations', async () => {
    expect(await service()).toEqual({ setPassword: expect.any(Function) })
  })

  it('returns a completed stage from the password endpoint', async () => {
    const handler = (await import('../../../server/api/auth/tenant-onboarding/password.post')).default

    await expect(handler(event({ password: 'new-password-123' }))).resolves.toEqual({ data: { stage: null } })
  })
})
