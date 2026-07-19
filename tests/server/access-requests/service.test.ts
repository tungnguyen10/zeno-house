import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { can as realCan } from '../../../server/utils/permissions'

vi.stubGlobal('can', realCan)

const requestRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findByUserId: vi.fn(),
  list: vi.fn(),
  claim: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  restorePending: vi.fn(),
  appendCreationAuditOnce: vi.fn(),
}))
const userRepo = vi.hoisted(() => ({ getAuthAccount: vi.fn(), setAppRole: vi.fn() }))
const buildingRepo = vi.hoisted(() => ({ findById: vi.fn() }))
const assignmentRepo = vi.hoisted(() => ({ insert: vi.fn(), findByUserAndBuilding: vi.fn(), removeByApprovalClaim: vi.fn() }))
const tenantRepo = vi.hoisted(() => ({ findById: vi.fn() }))
const linkRepo = vi.hoisted(() => ({ getByTenantId: vi.fn(), create: vi.fn(), deleteByApprovalClaim: vi.fn() }))
const auditService = vi.hoisted(() => ({ append: vi.fn() }))

vi.mock('../../../server/repositories/access-requests', () => ({ AccessRequestRepository: requestRepo }))
vi.mock('../../../server/repositories/users', () => ({ UserRepository: userRepo }))
vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: buildingRepo }))
vi.mock('../../../server/repositories/assignments', () => ({ AssignmentRepository: assignmentRepo }))
vi.mock('../../../server/repositories/tenants', () => ({ TenantRepository: tenantRepo }))
vi.mock('../../../server/repositories/tenant-portal/account-links', () => ({ TenantAccountLinkRepository: linkRepo }))
vi.mock('../../../server/services/audit', () => ({ AuditService: auditService }))

function actor(role: 'admin' | 'owner' = 'admin'): AuthUser {
  return { id: `${role}-1`, app_metadata: { role } } as AuthUser
}

const event = () => ({ context: {} }) as never
const request = {
  id: 'r-1', authUserId: 'u-1', email: 'user@example.com', fullName: 'User', provider: 'google',
  status: 'pending', emailVerified: true, decisionRole: null, decisionBuildingIds: [],
  decisionTenantId: null, rejectionReason: null, reviewedBy: null, reviewedAt: null,
  approvalClaimToken: null,
  createdAt: '', updatedAt: '',
}

async function service() {
  return (await import('../../../server/services/access-requests')).AccessRequestService
}

beforeEach(() => {
  vi.clearAllMocks()
  requestRepo.findById.mockResolvedValue(request)
  requestRepo.findByUserId.mockResolvedValue(request)
  requestRepo.list.mockResolvedValue([request])
  requestRepo.claim.mockResolvedValue({ ...request, status: 'processing', approvalClaimToken: 'claim-1' })
  requestRepo.approve.mockResolvedValue({ ...request, status: 'approved' })
  requestRepo.reject.mockResolvedValue({ ...request, status: 'rejected' })
  requestRepo.restorePending.mockResolvedValue(undefined)
  requestRepo.appendCreationAuditOnce.mockResolvedValue(false)
  userRepo.getAuthAccount.mockResolvedValue({ id: 'u-1', emailConfirmed: true, role: null })
  userRepo.setAppRole.mockResolvedValue(undefined)
  buildingRepo.findById.mockResolvedValue({ id: 'b-1' })
  assignmentRepo.insert.mockResolvedValue({ id: 'a-1' })
  assignmentRepo.findByUserAndBuilding.mockResolvedValue(null)
  assignmentRepo.removeByApprovalClaim.mockResolvedValue(undefined)
  tenantRepo.findById.mockResolvedValue({ id: 't-1' })
  linkRepo.getByTenantId.mockResolvedValue(null)
  linkRepo.create.mockResolvedValue({ id: 'l-1' })
  linkRepo.deleteByApprovalClaim.mockResolvedValue(undefined)
})

describe('AccessRequestService', () => {
  it('allows a missing-role user to read only their own request', async () => {
    const result = await (await service()).getMine(event(), { id: 'u-1', app_metadata: {} } as AuthUser)
    expect(requestRepo.findByUserId).toHaveBeenCalledWith(expect.anything(), 'u-1')
    expect(result.email).toBe('user@example.com')
  })

  it('delegates trigger-created audit to the atomic database operation', async () => {
    const accessRequests = await service()
    await accessRequests.getMine(event(), { id: 'u-1', app_metadata: {} } as AuthUser)
    await accessRequests.getMine(event(), { id: 'u-1', app_metadata: {} } as AuthUser)
    expect(requestRepo.appendCreationAuditOnce).toHaveBeenCalledTimes(2)
    expect(requestRepo.appendCreationAuditOnce).toHaveBeenCalledWith(expect.anything(), 'r-1', 'u-1')
    expect(auditService.append).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ action: 'user.access_request.created' }))
  })

  it('allows only admin to list requests', async () => {
    await expect((await service()).list(event(), actor('owner'), 'pending')).rejects.toMatchObject({ statusCode: 403 })
    expect(requestRepo.list).not.toHaveBeenCalled()
  })

  it('approves an internal account only after assignments exist', async () => {
    await (await service()).approve(event(), actor(), 'r-1', { role: 'manager', building_ids: ['b-1'] })
    expect(assignmentRepo.insert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ user_id: 'u-1', building_id: 'b-1' }))
    expect(userRepo.setAppRole).toHaveBeenCalledWith(expect.anything(), 'u-1', 'manager', 'admin-1')
    expect(requestRepo.approve).toHaveBeenCalled()
    expect(userRepo.setAppRole.mock.invocationCallOrder[0]).toBeLessThan(requestRepo.approve.mock.invocationCallOrder[0]!)
  })

  it('approves tenant only when the tenant has no account link', async () => {
    await (await service()).approve(event(), actor(), 'r-1', { role: 'tenant', tenant_id: 't-1' })
    expect(linkRepo.create).toHaveBeenCalledWith(expect.anything(), { authUserId: 'u-1', tenantId: 't-1', approvalClaimToken: 'claim-1' })
    expect(userRepo.setAppRole).toHaveBeenCalledWith(expect.anything(), 'u-1', 'tenant', 'admin-1')
  })

  it('rejects an unverified email before claiming the request', async () => {
    userRepo.getAuthAccount.mockResolvedValue({ id: 'u-1', emailConfirmed: false, role: null })
    await expect((await service()).approve(event(), actor(), 'r-1', { role: 'manager', building_ids: ['b-1'] })).rejects.toMatchObject({ statusCode: 422 })
    expect(requestRepo.claim).not.toHaveBeenCalled()
  })

  it('preserves fenced scope when the Auth role update fails ambiguously', async () => {
    userRepo.setAppRole.mockRejectedValue(new Error('auth failed'))
    userRepo.getAuthAccount
      .mockResolvedValueOnce({ id: 'u-1', emailConfirmed: true, role: null })
      .mockResolvedValueOnce({ id: 'u-1', emailConfirmed: true, role: null })
    await expect((await service()).approve(event(), actor(), 'r-1', { role: 'manager', building_ids: ['b-1'] })).rejects.toThrow('auth failed')
    expect(assignmentRepo.removeByApprovalClaim).not.toHaveBeenCalled()
    expect(requestRepo.restorePending).not.toHaveBeenCalled()
  })

  it('finalizes instead of deleting scope when an ambiguous Auth error actually granted the role', async () => {
    userRepo.setAppRole.mockRejectedValue(new Error('connection lost'))
    userRepo.getAuthAccount
      .mockResolvedValueOnce({ id: 'u-1', emailConfirmed: true, role: null })
      .mockResolvedValueOnce({ id: 'u-1', emailConfirmed: true, role: 'manager' })
    await expect((await service()).approve(event(), actor(), 'r-1', { role: 'manager', building_ids: ['b-1'] })).resolves.toMatchObject({ status: 'approved' })
    expect(assignmentRepo.removeByApprovalClaim).not.toHaveBeenCalled()
    expect(requestRepo.restorePending).not.toHaveBeenCalled()
  })

  it('fills missing scope before finalizing a processing request whose Auth role was already granted', async () => {
    requestRepo.findById.mockResolvedValue({
      ...request,
      status: 'processing',
      decisionRole: 'manager',
      decisionBuildingIds: ['b-1'],
      reviewedBy: 'admin-1',
      reviewedAt: new Date().toISOString(),
      approvalClaimToken: 'claim-1',
    })
    userRepo.getAuthAccount.mockResolvedValue({ id: 'u-1', emailConfirmed: true, role: 'manager' })
    await expect((await service()).approve(event(), actor(), 'r-1', { role: 'manager', building_ids: ['b-1'] })).resolves.toMatchObject({ status: 'approved' })
    expect(assignmentRepo.insert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ building_id: 'b-1', approval_claim_token: 'claim-1' }))
    expect(userRepo.setAppRole).not.toHaveBeenCalled()
    expect(requestRepo.approve).toHaveBeenCalledWith(expect.anything(), 'r-1', 'claim-1')
  })

  it('rejects a foreign assignment created between validation and post-claim scope creation', async () => {
    assignmentRepo.findByUserAndBuilding
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'foreign-a', approval_claim_token: 'other-claim' })

    await expect((await service()).approve(event(), actor(), 'r-1', { role: 'manager', building_ids: ['b-1'] })).rejects.toMatchObject({ statusCode: 409 })
    expect(userRepo.setAppRole).not.toHaveBeenCalled()
    expect(requestRepo.approve).not.toHaveBeenCalled()
  })

  it('rejects a foreign tenant link created between validation and post-claim scope creation', async () => {
    linkRepo.getByTenantId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'foreign-l', authUserId: 'other-user', approvalClaimToken: 'other-claim' })

    await expect((await service()).approve(event(), actor(), 'r-1', { role: 'tenant', tenant_id: 't-1' })).rejects.toMatchObject({ statusCode: 409 })
    expect(userRepo.setAppRole).not.toHaveBeenCalled()
    expect(requestRepo.approve).not.toHaveBeenCalled()
  })

  it('idempotently resumes a processing request with the same decision and no Auth role', async () => {
    requestRepo.findById.mockResolvedValue({
      ...request,
      status: 'processing',
      decisionRole: 'manager',
      decisionBuildingIds: ['b-1'],
      reviewedBy: 'admin-1',
      reviewedAt: new Date(Date.now() - 120_000).toISOString(),
      approvalClaimToken: 'claim-1',
    })
    userRepo.getAuthAccount.mockResolvedValue({ id: 'u-1', emailConfirmed: true, role: null })
    assignmentRepo.findByUserAndBuilding.mockResolvedValue({ id: 'a-1', approval_claim_token: 'claim-1' })
    await expect((await service()).approve(event(), actor(), 'r-1', { role: 'manager', building_ids: ['b-1'] })).resolves.toMatchObject({ status: 'approved' })
    expect(assignmentRepo.insert).not.toHaveBeenCalled()
    expect(userRepo.setAppRole).toHaveBeenCalledWith(expect.anything(), 'u-1', 'manager', 'admin-1')
    expect(requestRepo.claim).not.toHaveBeenCalled()
  })

  it('does not delete scope when an Auth timeout read still observes a null role', async () => {
    userRepo.setAppRole.mockRejectedValue(new Error('auth failed'))
    userRepo.getAuthAccount
      .mockResolvedValueOnce({ id: 'u-1', emailConfirmed: true, role: null })
      .mockResolvedValueOnce({ id: 'u-1', emailConfirmed: true, role: null })
    await expect((await service()).approve(event(), actor(), 'r-1', { role: 'manager', building_ids: ['b-1'] })).rejects.toThrow('auth failed')
    expect(assignmentRepo.removeByApprovalClaim).not.toHaveBeenCalled()
    expect(requestRepo.restorePending).not.toHaveBeenCalled()
  })

  it('rejects a pending request with durable reason and audit', async () => {
    await (await service()).reject(event(), actor(), 'r-1', { reason: 'Không xác minh được.' })
    expect(requestRepo.reject).toHaveBeenCalledWith(expect.anything(), 'r-1', 'admin-1', 'Không xác minh được.')
    expect(auditService.append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ action: 'user.access_request.rejected' }))
  })
})
