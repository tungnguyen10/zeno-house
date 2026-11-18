import { describe, expect, it } from 'vitest'
import { aggregateMetrics, percentile } from '../../scripts/benchmark-tenant-vision.mjs'

const emptyFields = {
  full_name: null, id_number: null, date_of_birth: null, gender: null, nationality: null,
  residence_address: null, address_label: null, birth_registration_place: null, place_of_origin: null,
  id_issued_date: null, id_expiry_date: null, id_issued_place: null,
}

function expected(fields: Record<string, string | null> = {}, overrides: Record<string, unknown> = {}) {
  return {
    document_type: 'can_cuoc_2024',
    capture_layout: 'separate_images',
    identity_mismatch: false,
    fields: { ...emptyFields, full_name: 'NGUYỄN VĂN MẪU', id_number: '001099000000', date_of_birth: '1999-01-31', ...fields },
    ...overrides,
  }
}

function sample(predicted: Record<string, unknown> | null, truth = expected(), extra: Record<string, unknown> = {}) {
  return {
    ok: predicted !== null,
    valid: predicted !== null,
    latencyMs: 1000,
    usage: { inputTokens: 1_000_000, outputTokens: 100_000 },
    predicted,
    expected: truth,
    ...extra,
  }
}

const perfect = () => ({ ...expected(), needs_review: true, warnings: [] })
const prices = { inputPerMTokMicroUsd: 1_000_000, outputPerMTokMicroUsd: 5_000_000 }

describe('percentile', () => {
  it('uses nearest-rank on sorted values', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10)
    expect(percentile([], 50)).toBeNull()
  })
})

describe('aggregateMetrics', () => {
  it('scores a perfect run', () => {
    const result = aggregateMetrics([sample(perfect()), sample(perfect())], prices)
    expect(result.samples).toBe(2)
    expect(result.jsonValidity).toBe(1)
    expect(result.idExactMatch).toBe(1)
    expect(result.nameExactMatch).toBe(1)
    expect(result.dobMatch).toBe(1)
    expect(result.layoutMatch).toBe(1)
    expect(result.unsupportedGuesses).toBe(0)
    expect(result.failureRate).toBe(0)
  })

  it('treats a changed leading zero as a wrong id', () => {
    const wrong = { ...perfect(), fields: { ...perfect().fields, id_number: '1099000000' } }
    expect(aggregateMetrics([sample(wrong), sample(perfect())], prices).idExactMatch).toBe(0.5)
  })

  it('counts non-null claims for fields that are null in the ground truth', () => {
    const guess = { ...perfect(), fields: { ...perfect().fields, nationality: 'Việt Nam', id_expiry_date: '2040-01-01' } }
    expect(aggregateMetrics([sample(guess)], prices).unsupportedGuesses).toBe(2)
  })

  it('counts failures separately from quality', () => {
    const result = aggregateMetrics([sample(perfect()), sample(null)], prices)
    expect(result.failureRate).toBe(0.5)
    expect(result.idExactMatch).toBe(1)
    expect(result.samples).toBe(2)
  })

  it('measures mismatch detection only on mismatching pairs', () => {
    const mismatchTruth = expected({}, { identity_mismatch: true })
    const detected = sample({ ...perfect(), identity_mismatch: true }, mismatchTruth)
    const missed = sample({ ...perfect(), identity_mismatch: false }, mismatchTruth)
    expect(aggregateMetrics([detected, missed, sample(perfect())], prices).mismatchDetection).toBe(0.5)
    expect(aggregateMetrics([sample(perfect())], prices).mismatchDetection).toBeNull()
  })

  it('measures below-card reading only on flagged samples', () => {
    const truth = expected({ id_issued_date: '2024-05-01' })
    const read = sample({ ...perfect(), fields: { ...perfect().fields, id_issued_date: '2024-05-01' } }, truth, { belowCardField: 'id_issued_date' })
    const missed = sample(perfect(), truth, { belowCardField: 'id_issued_date' })
    expect(aggregateMetrics([read, missed], prices).belowCardRead).toBe(0.5)
  })

  it('reports latency percentiles, tokens and cost per successful extraction', () => {
    const slow = { ...sample(perfect()), latencyMs: 3000 }
    const result = aggregateMetrics([sample(perfect()), slow], prices)
    expect(result.latencyMs).toEqual({ p50: 1000, p95: 3000 })
    expect(result.tokens).toEqual({ input: 2_000_000, output: 200_000 })
    // 2 * (1M in * $1/M + 100k out * $5/M) = 2 * 1.5 USD = 3.0 USD over 2 successes
    expect(result.costUsdPerSuccess).toBeCloseTo(1.5, 6)
  })

  it('never includes identity values in the output', () => {
    const text = JSON.stringify(aggregateMetrics([sample(perfect())], prices))
    expect(text).not.toContain('NGUYỄN')
    expect(text).not.toContain('001099000000')
  })
})
