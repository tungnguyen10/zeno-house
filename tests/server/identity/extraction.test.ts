import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const runtime = vi.hoisted(() => ({
  value: {
    enabled: true,
    apiKey: 'key',
    model: 'model-id',
    timeoutMs: 30_000,
    dailyLimit: 20,
    userDailyLimit: 10,
    dailyBudgetMicroUsd: 1_000_000,
    inputPricePerMTokMicroUsd: 1_000_000,
    outputPricePerMTokMicroUsd: 5_000_000,
    reserveMicroUsd: 20_000,
  },
}))
vi.mock('../../../server/utils/tenant-vision-runtime', () => ({ getTenantVisionRuntime: () => runtime.value }))

const usage = vi.hoisted(() => ({ reserve: vi.fn(), settle: vi.fn(), release: vi.fn() }))
vi.mock('../../../server/repositories/identity-ocr-usage', () => ({ IdentityOcrUsageRepository: usage }))

const provider = vi.hoisted(() => {
  class VisionProviderError extends Error {
    constructor(public kind: string, public retryAfterSeconds?: number) {
      super(`Vision provider error: ${kind}`)
    }
  }
  return { extractIdentityWithClaude: vi.fn(), VisionProviderError }
})
vi.mock('../../../server/services/ai/anthropic-vision', () => provider)

const tenantRepo = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), findAll: vi.fn() }))
vi.mock('../../../server/repositories/tenants', () => ({ TenantRepository: tenantRepo }))

const setResponseHeader = vi.hoisted(() => vi.fn())
vi.mock('h3', async importOriginal => ({ ...(await importOriginal<typeof import('h3')>()), setResponseHeader }))

const user = { id: 'user-1', app_metadata: { role: 'owner' } } as AuthUser
const ev = () => ({ context: {} }) as never

const SOI = Buffer.from([0xff, 0xd8])
const jpegBytes = Buffer.concat([
  SOI,
  Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]),
  Buffer.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x02]),
  Buffer.from([0x11, 0x22]),
  Buffer.from([0xff, 0xd9]),
])
const part = () => ({ data: jpegBytes, filename: 'front.jpg', type: 'image/jpeg' })

const rawExtraction = {
  document_type: 'can_cuoc_2024',
  capture_layout: 'front_only',
  fields: {
    full_name: 'NGUYEN VAN MAU',
    id_number: '001099000000',
    date_of_birth: '31/01/1999',
    gender: 'male',
    nationality: null,
    residence_address: 'Dia chi mau',
    address_label: 'noi_thuong_tru',
    birth_registration_place: null,
    place_of_origin: null,
    id_issued_date: null,
    id_expiry_date: null,
    id_issued_place: null,
  },
  warnings: [],
  identity_mismatch: false,
  needs_review: true,
}

async function load(purpose: 'tenant' | 'lessor' = 'tenant') {
  const { IdentityExtractionService } = await import('../../../server/services/identity/extraction')
  return {
    extract: (event: never, caller: AuthUser, parts: Parameters<typeof IdentityExtractionService.extract>[3]) =>
      IdentityExtractionService.extract(event, caller, purpose, parts),
  }
}

async function statusOf(promise: Promise<unknown>): Promise<number | undefined> {
  const error = await promise.then(() => null, (e: unknown) => e)
  return (error as { statusCode?: number } | null)?.statusCode
}

beforeEach(() => {
  vi.clearAllMocks()
  runtime.value.enabled = true
  vi.stubGlobal('can', (_user: AuthUser, capability: string) => capability === 'tenants.create' || capability === 'tenants.update')
  usage.reserve.mockResolvedValue({ kind: 'reserved', id: 'res-1' })
  usage.settle.mockResolvedValue(undefined)
  usage.release.mockResolvedValue(undefined)
  provider.extractIdentityWithClaude.mockResolvedValue({
    output: rawExtraction,
    usage: { inputTokens: 2_000_000, outputTokens: 1_000 },
    model: 'model-id-2026',
  })
})

describe('IdentityExtractionService.extract', () => {
  it('returns a normalized suggestion and settles usage with the computed cost', async () => {
    const service = await load()
    const result = await service.extract(ev(), user, [part()])
    expect(result.suggestion.fields.date_of_birth).toBe('1999-01-31')
    expect(result.suggestion.apply.permanent_address_allowed).toBe(true)
    expect(result.model).toBe('model-id-2026')
    // 2_000_000 in * 1_000_000 / 1e6 + 1_000 out * 5_000_000 / 1e6 = 2_000_000 + 5_000
    expect(usage.settle).toHaveBeenCalledWith(expect.anything(), 'res-1', {
      costMicroUsd: 2_005_000,
      inputTokens: 2_000_000,
      outputTokens: 1_000,
      model: 'model-id-2026',
    })
    expect(usage.release).not.toHaveBeenCalled()
  })

  it('reserves with the configured limits for the caller', async () => {
    const service = await load()
    await service.extract(ev(), user, [part()])
    expect(usage.reserve).toHaveBeenCalledWith(expect.anything(), 'user-1', {
      globalLimit: 20,
      userLimit: 10,
      budgetMicroUsd: 1_000_000,
      reserveMicroUsd: 20_000,
    })
  })

  it('returns 403 without tenant capabilities and never calls the provider', async () => {
    vi.stubGlobal('can', () => false)
    const service = await load()
    expect(await statusOf(service.extract(ev(), user, [part()]))).toBe(403)
    expect(provider.extractIdentityWithClaude).not.toHaveBeenCalled()
  })

  it('allows lessor scans with lessor PII access and no tenant capabilities', async () => {
    vi.stubGlobal('can', (_user: AuthUser, capability: string) => capability === 'building-contract-profile.pii.read')
    const service = await load('lessor')
    await expect(service.extract(ev(), user, [part()])).resolves.toBeTruthy()
  })

  it('returns 403 for lessor scans with only tenant capabilities', async () => {
    const service = await load('lessor')
    expect(await statusOf(service.extract(ev(), user, [part()]))).toBe(403)
    expect(usage.reserve).not.toHaveBeenCalled()
  })

  it('returns 503 when disabled', async () => {
    runtime.value.enabled = false
    const service = await load()
    expect(await statusOf(service.extract(ev(), user, [part()]))).toBe(503)
    expect(usage.reserve).not.toHaveBeenCalled()
  })

  it.each([
    ['too many files', [part(), part(), part()], 422],
    ['unsupported bytes', [{ data: Buffer.from('plain text') }], 415],
    ['oversized file', [{ data: Buffer.alloc(5 * 1024 * 1024 + 1, 1) }], 413],
  ])('rejects %s before reserving quota', async (_name, parts, status) => {
    const service = await load()
    expect(await statusOf(service.extract(ev(), user, parts as never))).toBe(status)
    expect(usage.reserve).not.toHaveBeenCalled()
    expect(provider.extractIdentityWithClaude).not.toHaveBeenCalled()
  })

  it('returns 429 without calling the provider when quota is exhausted', async () => {
    usage.reserve.mockResolvedValue({ kind: 'quota', reason: 'user' })
    const service = await load()
    expect(await statusOf(service.extract(ev(), user, [part()]))).toBe(429)
    expect(provider.extractIdentityWithClaude).not.toHaveBeenCalled()
  })

  it('maps a budget limit to 503', async () => {
    usage.reserve.mockResolvedValue({ kind: 'quota', reason: 'budget' })
    const service = await load()
    expect(await statusOf(service.extract(ev(), user, [part()]))).toBe(503)
  })

  it('allows only one in-flight request per user', async () => {
    let release: (value: unknown) => void = () => {}
    provider.extractIdentityWithClaude.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const service = await load()
    const first = service.extract(ev(), user, [part()])
    await vi.waitFor(() => expect(provider.extractIdentityWithClaude).toHaveBeenCalled())
    expect(await statusOf(service.extract(ev(), user, [part()]))).toBe(429)
    release({ output: rawExtraction, usage: { inputTokens: 1, outputTokens: 1 }, model: 'm' })
    await first
    await expect(service.extract(ev(), user, [part()])).resolves.toBeTruthy()
  })

  it.each([
    ['timeout', 504],
    ['unavailable', 503],
    ['rate_limited', 503],
    ['invalid_output', 502],
  ])('releases the reservation and maps provider %s to %i', async (kind, status) => {
    provider.extractIdentityWithClaude.mockRejectedValue(new provider.VisionProviderError(kind, kind === 'rate_limited' ? 9 : undefined))
    const service = await load()
    expect(await statusOf(service.extract(ev(), user, [part()]))).toBe(status)
    expect(usage.release).toHaveBeenCalledWith(expect.anything(), 'res-1')
    expect(usage.settle).not.toHaveBeenCalled()
  })

  it('sets Retry-After when the provider rate limits', async () => {
    provider.extractIdentityWithClaude.mockRejectedValue(new provider.VisionProviderError('rate_limited', 9))
    const service = await load()
    await service.extract(ev(), user, [part()]).catch(() => undefined)
    expect(setResponseHeader).toHaveBeenCalledWith(expect.anything(), 'Retry-After', 9)
  })

  it('releases and returns 502 when the model output fails the schema', async () => {
    provider.extractIdentityWithClaude.mockResolvedValue({
      output: { ...rawExtraction, extra: true },
      usage: { inputTokens: 1, outputTokens: 1 },
      model: 'm',
    })
    const service = await load()
    expect(await statusOf(service.extract(ev(), user, [part()]))).toBe(502)
    expect(usage.release).toHaveBeenCalledWith(expect.anything(), 'res-1')
  })

  it('does not fail the request when settling usage fails', async () => {
    usage.settle.mockRejectedValue(new Error('db down'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const service = await load()
    await expect(service.extract(ev(), user, [part()])).resolves.toBeTruthy()
    errorSpy.mockRestore()
  })

  it('never writes tenants and never logs identity values or image bytes', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(level => vi.spyOn(console, level).mockImplementation(() => undefined))
    usage.settle.mockRejectedValue(new Error('db down NGUYEN VAN MAU'))
    const service = await load()
    await service.extract(ev(), user, [part()])
    const logged = JSON.stringify(spies.flatMap(spy => spy.mock.calls))
    expect(logged).not.toContain('NGUYEN VAN MAU')
    expect(logged).not.toContain('001099000000')
    expect(logged).not.toContain(jpegBytes.toString('base64'))
    expect(tenantRepo.insert).not.toHaveBeenCalled()
    expect(tenantRepo.update).not.toHaveBeenCalled()
    spies.forEach(spy => spy.mockRestore())
  })
})
