import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const userRepo = vi.hoisted(() => ({
  update: vi.fn(),
  updateCurrentPassword: vi.fn(),
  getAuthAccount: vi.fn(),
  setTenantOnboardingStage: vi.fn(),
  setTenantOnboardingEmail: vi.fn(),
}))
const profileRepo = vi.hoisted(() => ({ updateLoginEmail: vi.fn() }))
const contractRepo = vi.hoisted(() => ({ findActiveByTenantId: vi.fn() }))
const scope = vi.hoisted(() => ({ resolveTenantId: vi.fn() }))
const auditService = vi.hoisted(() => ({ append: vi.fn() }))

vi.mock('../../../server/repositories/users', () => ({ UserRepository: userRepo }))
vi.mock('../../../server/repositories/tenant-portal/profile', () => ({ TenantProfileRepository: profileRepo }))
vi.mock('../../../server/repositories/contracts', () => ({ ContractRepository: contractRepo }))
vi.mock('../../../server/utils/scope', () => scope)
vi.mock('../../../server/services/audit', () => ({ AuditService: auditService }))

function event() {
  return { context: {} } as never
}

function tenant(stage: 'password_required' | 'email_required' | 'google_required'): AuthUser {
  return { id: 'auth-1', app_metadata: { role: 'tenant', tenant_onboarding: stage } } as AuthUser
}

async function service() {
  return (await import('../../../server/services/tenant-portal/onboarding')).TenantOnboardingService
}

beforeEach(() => {
  vi.clearAllMocks()
  scope.resolveTenantId.mockResolvedValue('tenant-1')
  contractRepo.findActiveByTenantId.mockResolvedValue({ buildingId: 'building-1' })
  userRepo.update.mockResolvedValue({ id: 'auth-1', email: 'tenant@gmail.com' })
  userRepo.updateCurrentPassword.mockResolvedValue(undefined)
  userRepo.setTenantOnboardingStage.mockResolvedValue(undefined)
  userRepo.setTenantOnboardingEmail.mockResolvedValue(undefined)
  profileRepo.updateLoginEmail.mockResolvedValue({ id: 'tenant-1', email: 'tenant@gmail.com' })
  auditService.append.mockResolvedValue(undefined)
})

describe('TenantOnboardingService', () => {
  it('changes the password through the tenant session before advancing to the email step', async () => {
    await (await service()).setPassword(event(), tenant('password_required'), { password: 'new-password-123' })

    expect(userRepo.updateCurrentPassword).toHaveBeenCalledWith(expect.anything(), 'new-password-123')
    expect(userRepo.update).not.toHaveBeenCalled()
    expect(userRepo.setTenantOnboardingStage).toHaveBeenCalledWith(expect.anything(), 'auth-1', 'email_required')
  })

  it('records the requested email before the client asks Supabase to confirm it', async () => {
    await (await service()).requestEmailChange(event(), tenant('email_required'), { email: 'tenant@gmail.com' })

    expect(userRepo.setTenantOnboardingEmail).toHaveBeenCalledWith(expect.anything(), 'auth-1', 'tenant@gmail.com')
  })

  it('syncs only a confirmed requested email and advances to Google linking', async () => {
    userRepo.getAuthAccount.mockResolvedValue({
      id: 'auth-1',
      email: 'tenant@gmail.com',
      emailConfirmed: true,
      tenantOnboardingEmail: 'tenant@gmail.com',
      identities: [],
    })

    await (await service()).confirmEmail(event(), tenant('email_required'))

    expect(profileRepo.updateLoginEmail).toHaveBeenCalledWith(expect.anything(), 'tenant-1', 'tenant@gmail.com')
    expect(userRepo.setTenantOnboardingStage).toHaveBeenCalledWith(expect.anything(), 'auth-1', 'google_required')
  })

  it('completes onboarding only after a Google identity proves the same email', async () => {
    userRepo.getAuthAccount.mockResolvedValue({
      id: 'auth-1',
      email: 'tenant@gmail.com',
      emailConfirmed: true,
      tenantOnboardingEmail: 'tenant@gmail.com',
      identities: [{ provider: 'google', identityData: { email: 'tenant@gmail.com', email_verified: true } }],
    })

    await (await service()).confirmGoogleLink(event(), tenant('google_required'))

    expect(userRepo.setTenantOnboardingStage).toHaveBeenCalledWith(expect.anything(), 'auth-1', null)
    expect(userRepo.setTenantOnboardingEmail).toHaveBeenCalledWith(expect.anything(), 'auth-1', null)
  })

  it('rejects a Google identity for a different email', async () => {
    userRepo.getAuthAccount.mockResolvedValue({
      id: 'auth-1',
      email: 'tenant@gmail.com',
      emailConfirmed: true,
      tenantOnboardingEmail: 'tenant@gmail.com',
      identities: [{ provider: 'google', identityData: { email: 'other@gmail.com', email_verified: true } }],
    })

    await expect((await service()).confirmGoogleLink(event(), tenant('google_required'))).rejects.toMatchObject({ statusCode: 422 })
    expect(userRepo.setTenantOnboardingStage).not.toHaveBeenCalled()
  })

  it('rejects an unverified Google identity even when the email matches', async () => {
    userRepo.getAuthAccount.mockResolvedValue({
      id: 'auth-1',
      email: 'tenant@gmail.com',
      emailConfirmed: true,
      tenantOnboardingEmail: 'tenant@gmail.com',
      identities: [{ provider: 'google', identityData: { email: 'tenant@gmail.com' } }],
    })

    await expect((await service()).confirmGoogleLink(event(), tenant('google_required'))).rejects.toMatchObject({ statusCode: 422 })
    expect(userRepo.setTenantOnboardingStage).not.toHaveBeenCalled()
  })
})
