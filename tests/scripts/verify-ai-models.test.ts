import { describe, expect, it } from 'vitest'
import { validateModelCatalog } from '../../scripts/verify-ai-models.mjs'

const primary = 'nvidia/nemotron-3-super-120b-a12b:free'
const paidPrimary = 'deepseek/deepseek-v4-flash-0731'
const fallback = 'google/gemma-4-31b-it:free'

function model(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    pricing: { prompt: '0', completion: '0' },
    supported_parameters: ['tools', 'tool_choice'],
    ...overrides,
  }
}

describe('AI model release gate', () => {
  it('accepts distinct zero-price models with tool calling', () => {
    expect(validateModelCatalog([model(primary), model(fallback)], primary, fallback)).toEqual({
      primary,
      fallback,
      allowPaidPrimary: false,
    })
  })

  it('accepts a priced primary only with explicit paid-primary opt-in', () => {
    const models = [
      model(paidPrimary, { pricing: { prompt: '0.1', completion: '0.2' } }),
      model(fallback),
    ]

    expect(() => validateModelCatalog(models, paidPrimary, fallback)).toThrow(/primary.*zero-cost/i)
    expect(validateModelCatalog(models, paidPrimary, fallback, true)).toEqual({
      primary: paidPrimary,
      fallback,
      allowPaidPrimary: true,
    })
  })

  it('rejects a priced fallback even with paid-primary opt-in', () => {
    expect(() => validateModelCatalog([
      model(paidPrimary, { pricing: { prompt: '0.1', completion: '0.2' } }),
      model(fallback, { pricing: { prompt: '0.1', completion: '0' } }),
    ], paidPrimary, fallback, true)).toThrow(/fallback.*zero-cost/i)
  })

  it('rejects missing, paid, or tool-less models', () => {
    expect(() => validateModelCatalog([model(primary)], primary, fallback)).toThrow(/missing/i)
    expect(() => validateModelCatalog([
      model(primary, { pricing: { prompt: '0.1', completion: '0' } }), model(fallback),
    ], primary, fallback)).toThrow(/zero-cost/i)
    expect(() => validateModelCatalog([
      model(primary), model(fallback, { supported_parameters: [] }),
    ], primary, fallback)).toThrow(/tools/i)
  })
})
