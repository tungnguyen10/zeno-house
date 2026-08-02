import { describe, expect, it } from 'vitest'
import { validateModelCatalog } from '../../scripts/verify-ai-models.mjs'

const primary = 'nvidia/nemotron-3-super-120b-a12b:free'
const fallback = 'google/gemma-4-31b-it:free'

function model(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    pricing: { prompt: '0', completion: '0' },
    supported_parameters: ['tools', 'tool_choice'],
    ...overrides,
  }
}

describe('free AI model release gate', () => {
  it('accepts distinct zero-price models with tool calling', () => {
    expect(validateModelCatalog([model(primary), model(fallback)], primary, fallback)).toEqual({ primary, fallback })
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
