import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiProviderControlService } from '../../../server/services/ai/provider-controls'

const { mocks, telemetry } = vi.hoisted(() => ({
  mocks: { acquire: vi.fn(), record: vi.fn() },
  telemetry: vi.fn(),
}))
vi.mock('../../../server/repositories/ai/provider-controls', () => ({
  AiProviderControlRepository: { acquire: mocks.acquire, record: mocks.record },
}))
vi.mock('../../../server/utils/ai-telemetry', () => ({ emitAiTelemetry: telemetry }))

describe('distributed AI provider controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('setResponseHeader', vi.fn())
  })

  it('allows a request when shared quota and circuit permit it', async () => {
    mocks.acquire.mockResolvedValue({ allowed: true, reason: null, retryAfterSeconds: 0 })
    await expect(AiProviderControlService.acquire({} as never, {
      provider: 'openrouter', dailyLimit: 40, failureThreshold: 5, cooldownMs: 60_000,
      requestId: 'request-1',
    })).resolves.toBeUndefined()
  })

  it('maps exhausted free capacity without invoking a model', async () => {
    mocks.acquire.mockResolvedValue({ allowed: false, reason: 'daily_quota', retryAfterSeconds: 3600 })
    await expect(AiProviderControlService.acquire({} as never, {
      provider: 'openrouter', dailyLimit: 40, failureThreshold: 5, cooldownMs: 60_000,
      requestId: 'request-2',
    })).rejects.toMatchObject({
      statusCode: 503,
      data: { error: { code: 'PROVIDER_CAPACITY', details: { retryable: true } } },
    })
    expect(telemetry).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      event: 'ai.circuit', requestId: 'request-2', provider: 'openrouter',
      outcome: 'rejected', errorCategory: 'PROVIDER_CAPACITY',
    }))
  })

  it('records only normalized success or failure outcomes', async () => {
    mocks.record.mockResolvedValue(undefined)
    await AiProviderControlService.record({} as never, { provider: 'openrouter', succeeded: false, failureThreshold: 5 })
    expect(mocks.record).toHaveBeenCalledWith(expect.anything(), {
      provider: 'openrouter', succeeded: false, failureThreshold: 5,
    })
  })
})
