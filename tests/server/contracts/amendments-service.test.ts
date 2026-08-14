import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const mocks = vi.hoisted(() => ({
  findContract: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  findAmendment: vi.fn(),
  updateDraft: vi.fn(),
  deleteDraft: vi.fn(),
  publish: vi.fn(),
  cancel: vi.fn(),
  applyDue: vi.fn(),
  appendAudit: vi.fn(),
  assertScope: vi.fn(),
}))

vi.mock('../../../server/repositories/contracts', () => ({
  ContractRepository: { findByIdentifier: mocks.findContract },
}))

vi.mock('../../../server/repositories/contract-amendments', () => ({
  ContractAmendmentRepository: {
    listByContract: mocks.list,
    createDraft: mocks.create,
    findById: mocks.findAmendment,
    updateDraft: mocks.updateDraft,
    deleteDraft: mocks.deleteDraft,
    publish: mocks.publish,
    cancel: mocks.cancel,
    applyDue: mocks.applyDue,
  },
}))

vi.mock('../../../server/services/audit', () => ({
  AuditService: { append: mocks.appendAudit },
}))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope: mocks.assertScope }))

function event() {
  return { context: {} } as never
}

function user(role: 'admin' | 'manager' | 'tenant' = 'admin'): AuthUser {
  return { id: 'user-1', app_metadata: { role } } as AuthUser
}

const contract = {
  id: 'contract-1',
  buildingId: 'building-1',
  status: 'active',
  endDate: '2027-06-30',
}

const amendmentId = '11111111-1111-4111-8111-111111111111'
const draft = {
  id: amendmentId,
  contractId: 'contract-1',
  status: 'draft',
  effectiveDate: '2026-09-01',
  updatedAt: '2026-08-14T09:00:00.000Z',
}

describe('ContractAmendmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', vi.fn(() => true))
    mocks.findContract.mockResolvedValue(contract)
    mocks.findAmendment.mockResolvedValue(draft)
    mocks.assertScope.mockResolvedValue(undefined)
  })

  it('enforces contract capability before reading amendments', async () => {
    vi.stubGlobal('can', vi.fn(() => false))
    const { ContractAmendmentService } = await import('../../../server/services/contract-amendments')

    await expect(ContractAmendmentService.list(event(), user('tenant'), 'contract-1'))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.list).not.toHaveBeenCalled()
  })

  it('creates a trimmed draft for an active contract', async () => {
    mocks.create.mockResolvedValue({ ...draft, title: 'Tăng giá thuê' })
    const { ContractAmendmentService } = await import('../../../server/services/contract-amendments')

    await ContractAmendmentService.create(event(), user(), 'contract-1', {
      title: '  Tăng giá thuê  ',
      public_content: '  Áp dụng mức giá mới.  ',
      effective_date: '2026-09-01',
      changes: { monthly_rent: 4_000_000 },
    })

    expect(mocks.create).toHaveBeenCalledWith(expect.anything(), 'contract-1', 'user-1', {
      title: 'Tăng giá thuê',
      public_content: 'Áp dụng mức giá mới.',
      effective_date: '2026-09-01',
      changes: { monthly_rent: 4_000_000 },
    }, expect.any(String))
    expect(mocks.assertScope).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'building-1', 'write')
  })

  it('rejects drafts for a contract that is no longer active', async () => {
    mocks.findContract.mockResolvedValue({ ...contract, status: 'terminated' })
    const { ContractAmendmentService } = await import('../../../server/services/contract-amendments')

    await expect(ContractAmendmentService.create(event(), user(), 'contract-1', {
      title: 'Điều chỉnh', public_content: 'Nội dung', effective_date: '2026-09-01', changes: { deposit: 1 },
    })).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('rejects recurring-term drafts outside the first day of month', async () => {
    const { ContractAmendmentService } = await import('../../../server/services/contract-amendments')

    await expect(ContractAmendmentService.create(event(), user(), 'contract-1', {
      title: 'Tăng giá thuê',
      public_content: 'Áp dụng mức giá mới.',
      effective_date: '2026-09-15',
      changes: { monthly_rent: 4_000_000 },
    })).rejects.toMatchObject({ statusCode: 422 })
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('returns an optimistic conflict when a stale draft cannot be updated', async () => {
    mocks.updateDraft.mockRejectedValue({ statusCode: 409 })
    const { ContractAmendmentService } = await import('../../../server/services/contract-amendments')

    await expect(ContractAmendmentService.update(event(), user(), 'contract-1', amendmentId, {
      title: 'Điều chỉnh',
      public_content: 'Nội dung mới',
      effective_date: '2026-09-01',
      changes: { deposit: 2_000_000 },
      expected_updated_at: draft.updatedAt,
    })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('publishes through the atomic RPC with the authenticated actor', async () => {
    mocks.publish.mockResolvedValue({ ...draft, status: 'scheduled' })
    const { ContractAmendmentService } = await import('../../../server/services/contract-amendments')

    await ContractAmendmentService.publish(event(), user(), 'contract-1', amendmentId, {
      expected_updated_at: draft.updatedAt,
    }, '2026-08-14')

    expect(mocks.publish).toHaveBeenCalledWith(
      expect.anything(), amendmentId, draft.updatedAt, 'user-1', '2026-08-14', expect.any(String),
    )
  })

  it('does not allow an amendment from another contract to be mutated', async () => {
    mocks.findAmendment.mockResolvedValue({ ...draft, contractId: 'contract-other' })
    const { ContractAmendmentService } = await import('../../../server/services/contract-amendments')

    await expect(ContractAmendmentService.publish(event(), user(), 'contract-1', amendmentId, {
      expected_updated_at: draft.updatedAt,
    }, '2026-08-14')).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it('rejects malformed amendment IDs before querying the repository', async () => {
    const { ContractAmendmentService } = await import('../../../server/services/contract-amendments')

    await expect(ContractAmendmentService.publish(event(), user(), 'contract-1', 'not-a-uuid', {
      expected_updated_at: draft.updatedAt,
    }, '2026-08-14')).rejects.toMatchObject({ statusCode: 422 })
    expect(mocks.findAmendment).not.toHaveBeenCalled()
  })

  it('applies due amendments without requiring a browser user', async () => {
    mocks.applyDue.mockResolvedValue([{ ...draft, status: 'applied' }])
    const { ContractAmendmentService } = await import('../../../server/services/contract-amendments')

    const result = await ContractAmendmentService.applyDue(event(), '2026-09-01', 'building-1')

    expect(result).toHaveLength(1)
    expect(mocks.applyDue).toHaveBeenCalledWith(expect.anything(), '2026-09-01', 'building-1')
  })
})
