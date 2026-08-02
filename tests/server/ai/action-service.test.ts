import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiActionPlan } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { AiActionService } from '../../../server/services/ai/actions'
import type { AiActionExecutorRegistry } from '../../../server/services/ai/executors'
import { hashAgentPayload, throwAgentError } from '../../../server/utils/ai'

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
  const normalizedPayload = overrides.normalizedPayload ?? { value: 1 }
  const resourceVersions = overrides.resourceVersions ?? { row: 'v1' }
  return {
    id: '00000000-0000-4000-8000-000000000002',
    conversationId: '00000000-0000-4000-8000-000000000003',
    userId: actor.id,
    buildingId: '00000000-0000-4000-8000-000000000004',
    actionType: 'test_mutation',
    title: 'Test mutation',
    summary: 'Preview only',
    normalizedPayload,
    payloadHash: hashAgentPayload(normalizedPayload, resourceVersions),
    preview: { value: 1 },
    warnings: [],
    resourceVersions,
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
    vi.resetAllMocks()
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
    expect(mocks.claim).toHaveBeenCalledWith(event, pending.id, actor.id, 30)
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

  it('marks a tampered payload stale before claiming', async () => {
    const tampered = plan({ payloadHash: '0'.repeat(64) })
    mocks.findPlan.mockResolvedValue(tampered)
    mocks.stale.mockResolvedValue(plan({ status: 'stale' }))

    await expect(AiActionService.confirm(event, actor, tampered.id, registry())).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { details: { category: 'OPTIMISTIC_LOCK_CONFLICT' } } },
    })
    expect(mocks.claim).not.toHaveBeenCalled()
  })

  it('rejects an executing plan while its lease is active', async () => {
    const executing = plan({
      status: 'executing',
      executionLeaseUntil: new Date(Date.now() + 30_000).toISOString(),
    })
    mocks.findPlan.mockResolvedValue(executing)
    mocks.claim.mockResolvedValue(null)
    await expect(AiActionService.confirm(event, actor, executing.id, registry())).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { details: { category: 'ACTION_RECOVERY_PENDING', retryable: true } } },
    })
  })

  it('reclaims an expired execution lease with the same idempotency key', async () => {
    const expiredLease = plan({
      status: 'executing',
      executionLeaseUntil: new Date(Date.now() - 1_000).toISOString(),
    })
    const claimed = plan({ status: 'executing', executionLeaseUntil: new Date(Date.now() + 30_000).toISOString() })
    const succeeded = plan({ status: 'succeeded', result: { ok: true } })
    const execute = vi.fn().mockResolvedValue({ ok: true })
    mocks.findPlan.mockResolvedValue(expiredLease)
    mocks.claim.mockResolvedValue(claimed)
    mocks.complete.mockResolvedValue(succeeded)

    await expect(AiActionService.confirm(event, actor, expiredLease.id, registry(execute))).resolves.toEqual({
      plan: succeeded, replayed: false,
    })
    expect(execute.mock.calls[0]?.[0].idempotencyKey).toBe(expiredLease.idempotencyKey)
  })

  it('leaves ambiguous executor failures executing for leased recovery', async () => {
    const pending = plan()
    const executing = plan({ status: 'executing' })
    mocks.findPlan.mockResolvedValue(pending)
    mocks.claim.mockResolvedValue(executing)
    const execute = vi.fn().mockRejectedValue(new Error('connection dropped'))

    await expect(AiActionService.confirm(event, actor, pending.id, registry(execute))).rejects.toBeTruthy()
    expect(mocks.fail).not.toHaveBeenCalled()
    expect(mocks.stale).not.toHaveBeenCalled()
  })

  it('leaves a committed action executing when plan completion fails', async () => {
    const pending = plan()
    const executing = plan({ status: 'executing' })
    mocks.findPlan.mockResolvedValue(pending)
    mocks.claim.mockResolvedValue(executing)
    mocks.complete.mockRejectedValue(new Error('completion unavailable'))

    await expect(AiActionService.confirm(event, actor, pending.id, registry())).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { details: { category: 'ACTION_RECOVERY_PENDING', retryable: true } } },
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
