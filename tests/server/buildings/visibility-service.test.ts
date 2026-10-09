import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { hasCapability } from '~/utils/constants/permissions'

const repoMocks = vi.hoisted(() => ({
  findByIdentifier: vi.fn(),
  setVisibility: vi.fn(),
  findAll: vi.fn(),
}))
const auditMocks = vi.hoisted(() => ({ append: vi.fn() }))
const scopeMocks = vi.hoisted(() => ({
  assertBuildingScope: vi.fn(),
  getAssignedBuildingIds: vi.fn(async () => null),
  getVisibleBuildingIds: vi.fn(async () => null),
}))

vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: repoMocks }))
vi.mock('../../../server/repositories/bulk-actions', () => ({ BulkActionRepository: {} }))
vi.mock('../../../server/repositories/assignments', () => ({ AssignmentRepository: {} }))
vi.mock('../../../server/services/audit', () => ({ AuditService: auditMocks }))
vi.mock('../../../server/utils/scope', () => scopeMocks)

function user(role: 'admin' | 'owner'): AuthUser {
  return { id: `${role}-1`, app_metadata: { role } } as AuthUser
}

function event() {
  return { context: {} } as never
}

const visible = { id: 'building-1', name: 'Zeno Central', isHidden: false }
const hidden = { ...visible, isHidden: true }

describe('BuildingService.setVisibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The global stub grants every capability; this suite is about the gate.
    vi.stubGlobal('can', (u: AuthUser, capability: string) =>
      hasCapability(u.app_metadata.role, capability))
    repoMocks.findByIdentifier.mockResolvedValue(visible)
    repoMocks.setVisibility.mockResolvedValue(hidden)
  })

  it('hides a building and records an audit event', async () => {
    const { BuildingService } = await import('../../../server/services/buildings')

    const result = await BuildingService.setVisibility(event(), user('admin'), 'building-1', { is_hidden: true })

    expect(result.isHidden).toBe(true)
    expect(repoMocks.setVisibility).toHaveBeenCalledWith(expect.anything(), 'building-1', true)
    expect(auditMocks.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        action: 'building.visibility_changed',
        entity_type: 'building',
        entity_id: 'building-1',
        before_data: { is_hidden: false },
        after_data: { is_hidden: true },
      }),
    )
  })

  it('refuses an owner even inside their assignment scope', async () => {
    const { BuildingService } = await import('../../../server/services/buildings')

    await expect(
      BuildingService.setVisibility(event(), user('owner'), 'building-1', { is_hidden: true }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(repoMocks.setVisibility).not.toHaveBeenCalled()
  })

  it('is a no-op when the value already matches', async () => {
    const { BuildingService } = await import('../../../server/services/buildings')

    await BuildingService.setVisibility(event(), user('admin'), 'building-1', { is_hidden: false })

    expect(repoMocks.setVisibility).not.toHaveBeenCalled()
    expect(auditMocks.append).not.toHaveBeenCalled()
  })

  it('scopes the default list by visibility and the admin list by assignment', async () => {
    const { BuildingService } = await import('../../../server/services/buildings')
    repoMocks.findAll.mockResolvedValue({ items: [], total: 0 })

    await BuildingService.list(event(), user('admin'), { page: 1, limit: 20 })
    expect(scopeMocks.getVisibleBuildingIds).toHaveBeenCalled()

    await BuildingService.list(event(), user('admin'), { page: 1, limit: 20, include_hidden: true })
    expect(scopeMocks.getAssignedBuildingIds).toHaveBeenCalled()
  })

  it('refuses include_hidden for a non-admin', async () => {
    const { BuildingService } = await import('../../../server/services/buildings')

    await expect(
      BuildingService.list(event(), user('owner'), { page: 1, limit: 20, include_hidden: true }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })
})
