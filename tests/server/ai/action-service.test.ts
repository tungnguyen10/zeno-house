import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiActionPlan } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { AiActionService } from '../../../server/services/ai/actions'
import type { AiActionExecutorRegistry } from '../../../server/services/ai/executors'
import { throwAgentError } from '../../../server/utils/ai'

const mocks = vi.hoisted(() => ({
  findPlan: vi.fn(),
  claim: vi.fn(),
  cancel: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  stale: vi.fn(),
  findConversation: vi.fn(),
  assertScope: vi.fn(),
  can: vi.fn(),
  telemetry: vi.fn(),
}))

vi.mock('../../../server/repositories/ai/actions', () => ({
  AiActionPlanRepository: {
    findOwnedById: mocks.findPlan,
    claim: mocks.claim,
    cancel: mocks.cancel,
    complete: mocks.complete,
    fail: mocks.fail,
    markStale: mocks.stale,
  },
}))
vi.mock('../../../server/repositories/ai/conversations', () => ({
  AiConversationRepository: { findOwnedById: mocks.findConversation },
}))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope: mocks.assertScope }))
vi.mock('../../../server/utils/permissions', () => ({ can: mocks.can }))
vi.mock('../../../server/utils/ai-telemetry', () => ({ emitAiTelemetry: mocks.telemetry }))
vi.mock('../../../server/utils/ai-runtime', () => ({
  getAiRuntimePolicy: vi.fn(() => ({ mutationExecutionEnabled: true })),
  isAiActionRuntimeEnabled: vi.fn(() => true),
}))
vi.mock('../../../server/services/ai/rate-limit', () => ({ enforceAiRateLimit: vi.fn() }))

const event = {} as never
const actor = { id: '00000000-0000-4000-8000-000000000001', app_metadata: { role: 'owner' } } as AuthUser

function plan(overrides: Partial<AiActionPlan> = {}): AiActionPlan {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    conversationId: '00000000-0000-4000-8000-000000000003',
    userId: actor.id,
    buildingId: '00000000-0000-4000-8000-000000000004',
    actionType: 'test_mutation',
    title: 'Test mutation',
    summary: 'Preview only',
    normalizedPayload: { value: 1 },
    payloadHash: 'a'.repeat(64),
    preview: { value: 1 },
    warnings: [],
    resourceVersions: { row: 'v1' },
    idempotencyKey: '00000000-0000-4000-8000-000000000005',
    status: 'pending',
    result: null,
    error: null,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    confirmedAt: null,
    executedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function registry(execute = vi.fn().mockResolvedValue({ ok: true })): AiActionExecutorRegistry {
  return { test_mutation: { requiredCapability: 'billing.write', execute } }
}

describe('AiActionService lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('getRequestHeader', vi.fn().mockReturnValue('request-1'))
    mocks.can.mockReturnValue(true)
    mocks.assertScope.mockResolvedValue(undefined)
  })

  it('does not reveal a plan owned by another user', async () => {
    mocks.findPlan.mockResolvedValue(null)
    await expect(AiActionService.confirm(event, actor, plan().id, registry())).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.claim).not.toHaveBeenCalled()
  })

  it('replays a succeeded result without executing again', async () => {
    const succeeded = plan({ status: 'succeeded', result: { invoiceId: 'invoice-1' } })
    const execute = vi.fn()
    mocks.findPlan.mockResolvedValue(succeeded)

    await expect(AiActionService.confirm(event, actor, succeeded.id, registry(execute))).resolves.toEqual({
      plan: succeeded,
      replayed: true,
    })
    expect(execute).not.toHaveBeenCalled()
    expect(mocks.claim).not.toHaveBeenCalled()
  })

  it('claims once, checks scope, executes, and completes atomically', async () => {
    const pending = plan()
    const executing = plan({ status: 'executing', confirmedAt: new Date().toISOString() })
    const succeeded = plan({ status: 'succeeded', result: { ok: true } })
    const execute = vi.fn().mockResolvedValue({ ok: true })
    mocks.findPlan.mockResolvedValue(pending)
    mocks.claim.mockResolvedValue(executing)
    mocks.complete.mockResolvedValue(succeeded)

    await expect(AiActionService.confirm(event, actor, pending.id, registry(execute))).resolves.toEqual({
      plan: succeeded,
      replayed: false,
    })
    expect(mocks.assertScope).toHaveBeenCalledWith(event, actor, pending.buildingId, 'write')
    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.calls[0]?.[0]).toMatchObject({ idempotencyKey: pending.idempotencyKey, plan: executing })
    expect(mocks.complete).toHaveBeenCalledWith(event, pending.id, actor.id, { ok: true })
  })

  it('rejects a lost concurrent claim without executing', async () => {
    const pending = plan()
    const executing = plan({ status: 'executing' })
    const execute = vi.fn()
    mocks.findPlan.mockResolvedValueOnce(pending).mockResolvedValueOnce(executing)
    mocks.claim.mockResolvedValue(null)

    await expect(AiActionService.confirm(event, actor, pending.id, registry(execute))).rejects.toMatchObject({ statusCode: 409 })
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects expired plans before claiming', async () => {
    const expired = plan({ expiresAt: new Date(Date.now() - 1_000).toISOString() })
    mocks.findPlan.mockResolvedValue(expired)
    await expect(AiActionService.confirm(event, actor, expired.id, registry())).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.claim).not.toHaveBeenCalled()
  })

  it('rechecks the executor capability before claiming', async () => {
    const pending = plan()
    mocks.findPlan.mockResolvedValue(pending)
    mocks.can.mockReturnValue(false)

    await expect(AiActionService.confirm(event, actor, pending.id, registry())).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.claim).not.toHaveBeenCalled()
  })

  it('marks optimistic-lock failures stale', async () => {
    const pending = plan()
    const executing = plan({ status: 'executing' })
    mocks.findPlan.mockResolvedValue(pending)
    mocks.claim.mockResolvedValue(executing)
    const execute = vi.fn().mockImplementation(() => {
      throwAgentError(409, 'CONFLICT', 'Version changed', {
        category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true, actionPlanId: pending.id,
      })
    })

    await expect(AiActionService.confirm(event, actor, pending.id, registry(execute))).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.stale).toHaveBeenCalledWith(event, pending.id, actor.id, {
      category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true,
    })
    expect(mocks.fail).not.toHaveBeenCalled()
  })

  it('cancels pending plans and makes cancellation replay-safe', async () => {
    const pending = plan()
    const cancelled = plan({ status: 'cancelled' })
    mocks.findPlan.mockResolvedValueOnce(pending).mockResolvedValueOnce(cancelled)
    mocks.cancel.mockResolvedValue(cancelled)

    await expect(AiActionService.cancel(event, actor, pending.id)).resolves.toEqual(cancelled)
    await expect(AiActionService.cancel(event, actor, pending.id)).resolves.toEqual(cancelled)
    expect(mocks.cancel).toHaveBeenCalledOnce()
  })
})
