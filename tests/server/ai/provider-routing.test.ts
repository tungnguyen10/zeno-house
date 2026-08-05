import { describe, expect, it } from 'vitest'
import {
  buildOpenRouterProviderOptions,
  resolveAiProviderConfig,
  resolveModelRoute,
  selectBoundedHistory,
} from '../../../server/services/ai/provider'

function runtime(overrides: Record<string, unknown> = {}) {
  return {
    aiProvider: 'openrouter',
    aiOpenrouterApiKey: 'test-key',
    aiGoogleApiKey: '',
    aiModel: 'nvidia/nemotron-3-super-120b-a12b:free',
    aiModelFallback: 'google/gemma-4-31b-it:free',
    aiMaxSteps: 8,
    aiMaxOutputTokens: 1200,
    aiMaxContextMessages: 20,
    aiMaxContextChars: 12_000,
    public: { siteUrl: 'https://zeno.example' },
    ...overrides,
  } as never
}

describe('AI provider routing', () => {
  it('rejects a paid production primary without explicit opt-in', () => {
    expect(() => resolveAiProviderConfig(runtime({
      aiModel: 'deepseek/deepseek-v4-flash-0731',
    }), true)).toThrow(/free/i)
  })

  it('accepts a paid production primary with explicit opt-in', () => {
    const config = resolveAiProviderConfig(runtime({
      aiModel: 'deepseek/deepseek-v4-flash-0731',
      aiAllowPaidPrimary: true,
    }), true)

    expect(config.modelPrimary).toBe('deepseek/deepseek-v4-flash-0731')
    expect(config.allowPaidPrimary).toBe(true)
  })

  it('still rejects a paid production fallback with paid primary opt-in', () => {
    expect(() => resolveAiProviderConfig(runtime({
      aiAllowPaidPrimary: true,
      aiModelFallback: 'deepseek/deepseek-v4-flash-0731',
    }), true)).toThrow(/fallback.*free/i)
  })

  it('rejects duplicate production models', () => {
    expect(() => resolveAiProviderConfig(runtime({
      aiModelFallback: 'nvidia/nemotron-3-super-120b-a12b:free',
    }), true)).toThrow(/different|khác/i)
  })

  it('passes an explicit free fallback and privacy policy to OpenRouter', () => {
    const config = resolveAiProviderConfig(runtime(), true)
    expect(buildOpenRouterProviderOptions(config)).toEqual({
      openrouter: {
        models: ['google/gemma-4-31b-it:free'],
        provider: {
          allow_fallbacks: true,
          data_collection: 'deny',
          require_parameters: true,
        },
      },
    })
  })

  it('reports the model that actually completed the response', () => {
    const config = resolveAiProviderConfig(runtime(), true)
    expect(resolveModelRoute(config, 'google/gemma-4-31b-it:free')).toEqual({
      requestedModel: 'nvidia/nemotron-3-super-120b-a12b:free',
      selectedModel: 'google/gemma-4-31b-it:free',
      fallbackUsed: true,
    })
    expect(resolveModelRoute(config, undefined).fallbackUsed).toBe(false)
  })

  it('keeps the newest complete messages within count and content budgets', () => {
    const history = [
      { role: 'user' as const, content: 'old-user' },
      { role: 'assistant' as const, content: 'old-assistant' },
      { role: 'user' as const, content: 'current-user' },
    ]

    expect(selectBoundedHistory(history, { maxMessages: 3, maxChars: 25 })).toEqual([
      { role: 'assistant', content: 'old-assistant' },
      { role: 'user', content: 'current-user' },
    ])
    expect(selectBoundedHistory(history, { maxMessages: 1, maxChars: 5 })).toEqual([
      { role: 'user', content: 'current-user' },
    ])
  })
})
