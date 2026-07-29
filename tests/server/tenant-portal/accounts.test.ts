import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { can as realCan } from '../../../server/utils/permissions'

// Use the real capability map so capability gating is actually enforced.
vi.stubGlobal('can', realCan)

const linkRepo = vi.hoisted(() => ({
  getByTenantId: vi.fn(),
  listAll: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
  deleteByTenantId: vi.fn(),
  getByAuthUserId: vi.fn(),
}))
const userRepo = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  setTenantOnboardingStage: vi.fn(),
  remove: vi.fn(),
  getById: vi.fn(),
  getAuthAccount: vi.fn(),
  listAuthIdentities: vi.fn(),
}))
const tenantRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  hasContractInBuildings: vi.fn(),
  wasCreatedByActor: vi.fn(),
  findCreatedTenantIdsByActor: vi.fn(),
  findTenantIdsForBuildings: vi.fn(),
  findByIds: vi.fn(),
}))
const scope = vi.hoisted(() => ({ getAssignedBuildingIds: vi.fn() }))
const auditService = vi.hoisted(() => ({ append: vi.fn() }))

vi.mock('../../../server/repositories/tenant-portal/account-links', () => ({
  TenantAccountLinkRepository: linkRepo,
}))
vi.mock('../../../server/repositories/users', () => ({ UserRepository: userRepo }))
vi.mock('../../../server/repositories/tenants', () => ({ TenantRepository: tenantRepo }))
vi.mock('../../../server/utils/scope', () => scope)
vi.mock('../../../server/services/audit', () => ({ AuditService: auditService }))

function user(role: 'admin' | 'owner' | 'manager', id = `${role}-1`): AuthUser {
  return { id, app_metadata: { role } } as AuthUser
}

function event() {
  return { context: {} } as never
}

const tenant = { id: 't-1', code: 'T-001', fullName: 'Nguyen Van A', email: 'a@example.com' }

async function service() {
  return (await import('../../../server/services/tenant-portal/accounts')).TenantAccountService
}

beforeEach(() => {
  vi.clearAllMocks()
  tenantRepo.findById.mockResolvedValue(tenant)
  scope.getAssignedBuildingIds.mockResolvedValue(null) // admin by default
  linkRepo.getByTenantId.mockResolvedValue(null)
  userRepo.create.mockResolvedValue({ id: 'auth-1', email: 'login@example.com' })
  linkRepo.create.mockResolvedValue({ id: 'l-1', authUserId: 'auth-1', tenantId: 't-1', status: 'active', createdAt: '' })
  linkRepo.deleteByTenantId.mockResolvedValue(undefined)
  linkRepo.getByAuthUserId.mockResolvedValue(null)
  userRepo.remove.mockResolvedValue('deleted')
  userRepo.getAuthAccount.mockResolvedValue({
    id: 'auth-1',
    email: 'login@example.com',
    role: 'tenant',
    deletedAt: null,
  })
  userRepo.listAuthIdentities.mockResolvedValue([])
})

describe('TenantAccountService.provision', () => {
  it('admin provisions a tenant auth user (role tenant) and links it', async () => {
    const svc = await service()
    const cred = await svc.provision(event(), user('admin'), 't-1', { email: 'login@example.com' })

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        email: 'login@example.com',
        role: 'tenant',
        tenant_onboarding: 'password_required',
      }),
    )
    expect(linkRepo.create).toHaveBeenCalledWith(
      expect.anything(),
      { authUserId: 'auth-1', tenantId: 't-1' },
    )
    expect(cred.email).toBe('login@example.com')
    expect(cred.tempPassword).toBeTruthy()
    expect(auditService.append).toHaveBeenCalled()
  })

  it('rejects when the tenant is already linked', async () => {
    linkRepo.getByTenantId.mockResolvedValue({ id: 'l-1', authUserId: 'x', tenantId: 't-1', status: 'active', createdAt: '' })
    const svc = await service()
    await expect(svc.provision(event(), user('admin'), 't-1', { email: 'e@e.com' })).rejects.toBeTruthy()
    expect(userRepo.create).not.toHaveBeenCalled()
  })

  it('rolls back the auth user when linking fails', async () => {
    linkRepo.create.mockRejectedValue(new Error('unique violation'))
    const svc = await service()
    await expect(svc.provision(event(), user('admin'), 't-1', { email: 'e@e.com' })).rejects.toBeTruthy()
    expect(userRepo.remove).toHaveBeenCalledWith(expect.anything(), 'auth-1')
  })

  it('forbids a manager (no capability)', async () => {
    const svc = await service()
    await expect(svc.provision(event(), user('manager'), 't-1', { email: 'e@e.com' })).rejects.toBeTruthy()
    expect(tenantRepo.findById).not.toHaveBeenCalled()
  })

  it('hides an out-of-scope tenant from an owner (not found)', async () => {
    scope.getAssignedBuildingIds.mockResolvedValue(['b-1'])
    tenantRepo.hasContractInBuildings.mockResolvedValue(false)
    tenantRepo.wasCreatedByActor.mockResolvedValue(false)
    const svc = await service()
    await expect(svc.provision(event(), user('owner'), 't-1', { email: 'e@e.com' })).rejects.toBeTruthy()
    expect(userRepo.create).not.toHaveBeenCalled()
  })

  it('allows an owner within scope', async () => {
    scope.getAssignedBuildingIds.mockResolvedValue(['b-1'])
    tenantRepo.hasContractInBuildings.mockResolvedValue(true)
    const svc = await service()
    await svc.provision(event(), user('owner'), 't-1', { email: 'login@example.com' })
    expect(linkRepo.create).toHaveBeenCalled()
  })
})

describe('TenantAccountService lifecycle', () => {
  beforeEach(() => {
    linkRepo.getByTenantId.mockResolvedValue({ id: 'l-1', authUserId: 'auth-1', tenantId: 't-1', status: 'active', createdAt: '' })
    userRepo.getById.mockResolvedValue({ id: 'auth-1', email: 'login@example.com' })
  })

  it('disables an account', async () => {
    linkRepo.updateStatus.mockResolvedValue({ id: 'l-1', authUserId: 'auth-1', tenantId: 't-1', status: 'disabled', createdAt: '' })
    const svc = await service()
    const state = await svc.setStatus(event(), user('admin'), 't-1', { status: 'disabled' })
    expect(linkRepo.updateStatus).toHaveBeenCalledWith(expect.anything(), 't-1', 'disabled')
    expect(state.status).toBe('disabled')
  })

  it('resets the password and returns new credentials', async () => {
    userRepo.update.mockResolvedValue({ id: 'auth-1', email: 'login@example.com' })
    const svc = await service()
    const cred = await svc.resetPassword(event(), user('admin'), 't-1')
    expect(userRepo.update).toHaveBeenCalledWith(expect.anything(), 'auth-1', expect.objectContaining({ password: expect.any(String) }))
    expect(userRepo.setTenantOnboardingStage).toHaveBeenCalledWith(expect.anything(), 'auth-1', 'password_required')
    expect(cred.tempPassword).toBeTruthy()
  })

  it('revokes by deleting the auth user', async () => {
    const svc = await service()
    await expect(svc.revoke(event(), user('admin'), 't-1')).resolves.toEqual({ outcome: 'deleted' })
    expect(userRepo.remove).toHaveBeenCalledWith(expect.anything(), 'auth-1')
    expect(linkRepo.updateStatus).toHaveBeenCalledWith(expect.anything(), 't-1', 'disabled')
    expect(linkRepo.deleteByTenantId).toHaveBeenCalledWith(expect.anything(), 't-1')
  })

  it('cleans a dangling link without retrying a missing Auth user', async () => {
    userRepo.getAuthAccount.mockResolvedValue(null)
    const svc = await service()

    await expect(svc.revoke(event(), user('admin'), 't-1')).resolves.toEqual({ outcome: 'deactivated' })
    expect(userRepo.remove).not.toHaveBeenCalled()
    expect(linkRepo.deleteByTenantId).toHaveBeenCalled()
  })

  it('reports a linked tenant whose Auth identity disappeared as missing_auth', async () => {
    linkRepo.listAll.mockResolvedValue([
      { authUserId: 'missing', tenantId: 't-1', status: 'disabled', createdAt: '2026-01-01' },
    ])
    tenantRepo.findByIds.mockResolvedValue([tenant])
    userRepo.listAuthIdentities.mockResolvedValue([])
    const svc = await service()

    await expect(svc.list(event(), user('admin'))).resolves.toEqual([
      expect.objectContaining({
        authUserId: 'missing',
        tenantId: 't-1',
        health: 'missing_auth',
        email: null,
      }),
    ])
  })
})

describe('TenantAccountService orphan reconciliation', () => {
  it('lists unlinked tenant-role identities for admins only', async () => {
    linkRepo.listAll.mockResolvedValue([
      { authUserId: 'linked', tenantId: 't-1' },
    ])
    userRepo.listAuthIdentities.mockResolvedValue([
      { id: 'linked', role: 'tenant', deletedAt: null },
      { id: 'orphan', role: 'tenant', email: 'orphan@example.com', createdAt: '2026-01-01', lastSignInAt: null, deletedAt: null },
      { id: 'owner', role: 'owner', deletedAt: null },
    ])
    const svc = await service()

    await expect(svc.listOrphans(event(), user('admin'))).resolves.toEqual([
      expect.objectContaining({ authUserId: 'orphan', health: 'orphaned' }),
    ])
    await expect(svc.listOrphans(event(), user('owner'))).rejects.toBeTruthy()
  })

  it('reconciles only a currently unlinked tenant identity', async () => {
    userRepo.getAuthAccount.mockResolvedValue({
      id: 'orphan',
      role: 'tenant',
      deletedAt: null,
    })
    userRepo.remove.mockResolvedValue('deactivated')
    const svc = await service()

    await expect(svc.reconcileOrphan(event(), user('admin'), 'orphan'))
      .resolves.toEqual({ outcome: 'deactivated' })
    expect(userRepo.remove).toHaveBeenCalledWith(expect.anything(), 'orphan')
  })
})
