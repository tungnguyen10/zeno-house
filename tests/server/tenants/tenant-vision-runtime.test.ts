import { describe, expect, it } from 'vitest'
import { resolveTenantVisionRuntime } from '../../../server/utils/tenant-vision-runtime'

const base = {
  aiTenantVisionEnabled: true,
  aiTenantAnthropicApiKey: 'key',
  aiTenantVisionModel: 'model-id',
}

describe('resolveTenantVisionRuntime', () => {
  it('is disabled by default', () => {
    expect(resolveTenantVisionRuntime({}).enabled).toBe(false)
  })

  it('requires the flag, an api key and a model', () => {
    expect(resolveTenantVisionRuntime(base).enabled).toBe(true)
    expect(resolveTenantVisionRuntime({ ...base, aiTenantVisionEnabled: false }).enabled).toBe(false)
    expect(resolveTenantVisionRuntime({ ...base, aiTenantAnthropicApiKey: '' }).enabled).toBe(false)
    expect(resolveTenantVisionRuntime({ ...base, aiTenantVisionModel: '  ' }).enabled).toBe(false)
  })

  it('exposes an optional workspace id', () => {
    expect(resolveTenantVisionRuntime(base).workspaceId).toBe('')
    expect(resolveTenantVisionRuntime({ ...base, aiTenantAnthropicWorkspaceId: ' wrkspc_1 ' }).workspaceId).toBe('wrkspc_1')
  })

  it('accepts string flags from env', () => {
    expect(resolveTenantVisionRuntime({ ...base, aiTenantVisionEnabled: 'true' }).enabled).toBe(true)
    expect(resolveTenantVisionRuntime({ ...base, aiTenantVisionEnabled: 'false' }).enabled).toBe(false)
  })

  it('applies defaults', () => {
    expect(resolveTenantVisionRuntime(base)).toMatchObject({
      timeoutMs: 30_000,
      dailyLimit: 20,
      userDailyLimit: 10,
      dailyBudgetMicroUsd: 1_000_000,
      inputPricePerMTokMicroUsd: 0,
      outputPricePerMTokMicroUsd: 0,
      reserveMicroUsd: 20_000,
    })
  })

  it('clamps values to safe bounds', () => {
    const runtime = resolveTenantVisionRuntime({
      ...base,
      aiTenantVisionTimeoutMs: 1,
      aiTenantOcrDailyLimit: 999_999,
      aiTenantOcrUserDailyLimit: 0,
      aiTenantOcrDailyBudgetMicroUsd: 10_000_000_000,
      aiTenantOcrReserveMicroUsd: -5,
    })
    expect(runtime.timeoutMs).toBe(5_000)
    expect(runtime.dailyLimit).toBe(1_000)
    expect(runtime.userDailyLimit).toBe(1)
    expect(runtime.dailyBudgetMicroUsd).toBe(100_000_000)
    expect(runtime.reserveMicroUsd).toBe(0)
  })

  it('falls back on non numeric values', () => {
    expect(resolveTenantVisionRuntime({ ...base, aiTenantOcrDailyLimit: 'abc' }).dailyLimit).toBe(20)
  })
})
