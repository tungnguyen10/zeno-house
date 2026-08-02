import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isAiActionRuntimeEnabled,
  isAiToolRuntimeEnabled,
  resolveAiRuntimePolicy,
} from '../../../server/utils/ai-runtime'

const consume = vi.fn()
const cleanupConversations = vi.fn()
const cleanupBuckets = vi.fn()
const telemetry = vi.fn()

vi.mock('../../../server/repositories/ai/rate-limits', () => ({
  AiRateLimitRepository: { consume, cleanup: cleanupBuckets },
}))
vi.mock('../../../server/repositories/ai/conversations', () => ({
  AiConversationRepository: { cleanupExpired: cleanupConversations },
}))
vi.mock('../../../server/utils/ai-telemetry', () => ({ emitAiTelemetry: telemetry }))

function runtime(overrides: Record<string, unknown> = {}) {
  return resolveAiRuntimePolicy({
    aiChatEnabled: false,
    aiReadToolsEnabled: false,
    aiMutationPlanningEnabled: false,
    aiMutationExecutionEnabled: false,
    aiInvoiceIssueEnabled: false,
    aiInvoiceVoidEnabled: false,
    aiInvoiceReissueEnabled: false,
    aiInvoiceAdjustmentEnabled: false,
    aiProviderTimeoutMs: 30_000,
    aiChatRateLimit: 20,
    aiActionRateLimit: 30,
    aiRateWindowSeconds: 60,
    aiCircuitFailureThreshold: 3,
    aiCircuitCooldownMs: 1_000,
    aiGlobalDailyLimit: 40,
    aiActionLeaseSeconds: 30,
    aiRetentionCleanupEnabled: true,
    aiRetentionCleanupBatchSize: 500,
    ...overrides,
  } as never)
}

describe('AI production runtime controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps private server switches independent from public UI visibility', () => {
    const policy = runtime()
    expect(policy.chatEnabled).toBe(false)
    expect(isAiToolRuntimeEnabled(policy, { name: 'get_meter_status', mode: 'read' })).toBe(false)
    expect(isAiToolRuntimeEnabled(policy, { name: 'plan_invoice_issue', mode: 'plan' })).toBe(false)
    expect(isAiActionRuntimeEnabled(policy, 'issue_invoices')).toBe(false)
    expect(policy.globalDailyLimit).toBe(40)
    expect(policy.actionLeaseSeconds).toBe(30)
  })

  it('bounds global quota and execution lease configuration', () => {
    expect(runtime({ aiGlobalDailyLimit: 0, aiActionLeaseSeconds: 2 })).toMatchObject({
      globalDailyLimit: 1,
      actionLeaseSeconds: 5,
    })
    expect(runtime({ aiGlobalDailyLimit: 20_000, aiActionLeaseSeconds: 900 })).toMatchObject({
      globalDailyLimit: 10_000,
      actionLeaseSeconds: 300,
    })
  })

  it('can enable reads while killing one invoice mutation class', () => {
    const policy = runtime({
      aiReadToolsEnabled: 'true',
      aiMutationPlanningEnabled: 'true',
      aiMutationExecutionEnabled: 'true',
      aiInvoiceIssueEnabled: 'false',
      aiInvoiceVoidEnabled: 'true',
    })
    expect(isAiToolRuntimeEnabled(policy, { name: 'get_meter_status', mode: 'read' })).toBe(true)
    expect(isAiToolRuntimeEnabled(policy, { name: 'plan_invoice_issue', mode: 'plan' })).toBe(false)
    expect(isAiToolRuntimeEnabled(policy, { name: 'plan_void_invoice', mode: 'plan' })).toBe(true)
    expect(isAiActionRuntimeEnabled(policy, 'issue_invoices')).toBe(false)
    expect(isAiActionRuntimeEnabled(policy, 'void_invoice')).toBe(true)
  })

  it('returns a retryable 429 when the distributed bucket rejects a request', async () => {
    consume.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 17 })
    const setHeader = vi.fn()
    vi.stubGlobal('setResponseHeader', setHeader)
    const { enforceAiRateLimit } = await import('../../../server/services/ai/rate-limit')
    await expect(enforceAiRateLimit({} as never, {
      userId: 'user-1', scope: 'chat', requestId: 'request-1', policy: runtime(),
    })).rejects.toMatchObject({
      statusCode: 429,
      data: { error: { code: 'RATE_LIMITED', details: { retryable: true, retryAfterSeconds: 17 } } },
    })
    expect(setHeader).toHaveBeenCalledWith(expect.anything(), 'Retry-After', 17)
    expect(consume.mock.calls[0]![1].subjectHash).toMatch(/^[a-f0-9]{64}$/)
    expect(consume.mock.calls[0]![1].subjectHash).not.toContain('user-1')
  })

  it('cleans conversations and rate buckets in bounded independent batches', async () => {
    cleanupConversations.mockResolvedValue(20)
    cleanupBuckets.mockResolvedValue(100)
    vi.stubGlobal('getRequestHeader', vi.fn().mockReturnValue('request-1'))
    const { AiRetentionService } = await import('../../../server/services/ai/retention')
    await expect(AiRetentionService.cleanup({} as never, 50)).resolves.toEqual({
      conversationsDeleted: 20,
      rateBucketsDeleted: 100,
    })
    expect(cleanupConversations).toHaveBeenCalledWith(expect.anything(), 50)
    expect(cleanupBuckets).toHaveBeenCalledWith(expect.anything(), 500)
    expect(telemetry).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      event: 'ai.cleanup', outcome: 'succeeded',
    }))
  })
})
