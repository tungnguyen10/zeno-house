// Manual benchmark for identity extraction. Fictional fixtures only; prints aggregate metrics, never identity values.
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Run from the repository root.
const root = process.cwd()
const FIXTURE_DIR = join(root, 'tests/__fixtures__/identity-cards')
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
const CONFIRM_FLAG = '--i-confirm-fictional-fixtures'

export function percentile(values, p) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]
}

const ratio = (hits, total) => (total === 0 ? null : hits / total)

export function aggregateMetrics(samples, prices = { inputPerMTokMicroUsd: 0, outputPerMTokMicroUsd: 0 }) {
  const done = samples.filter(item => item.ok)
  const valid = done.filter(item => item.valid)
  const scored = valid.filter(item => item.predicted)

  const count = (predicate) => scored.filter(predicate).length
  const withId = scored.filter(item => item.expected.fields.id_number !== null)
  const withName = scored.filter(item => item.expected.fields.full_name !== null)
  const withDob = scored.filter(item => item.expected.fields.date_of_birth !== null)
  const mismatchPairs = scored.filter(item => item.expected.identity_mismatch === true)
  const belowCard = scored.filter(item => item.belowCardField)

  const unsupportedGuesses = scored.reduce((sum, item) => sum + Object.entries(item.expected.fields)
    .filter(([key, value]) => value === null && item.predicted.fields?.[key] != null).length, 0)

  const tokens = done.reduce((acc, item) => ({
    input: acc.input + item.usage.inputTokens,
    output: acc.output + item.usage.outputTokens,
  }), { input: 0, output: 0 })
  const costMicroUsd = (tokens.input * prices.inputPerMTokMicroUsd + tokens.output * prices.outputPerMTokMicroUsd) / 1e6

  return {
    samples: samples.length,
    failureRate: ratio(samples.length - done.length, samples.length),
    jsonValidity: ratio(valid.length, done.length),
    idExactMatch: ratio(withId.filter(item => item.predicted.fields.id_number === item.expected.fields.id_number).length, withId.length),
    nameExactMatch: ratio(withName.filter(item => item.predicted.fields.full_name === item.expected.fields.full_name).length, withName.length),
    dobMatch: ratio(withDob.filter(item => item.predicted.fields.date_of_birth === item.expected.fields.date_of_birth).length, withDob.length),
    layoutMatch: ratio(count(item => item.predicted.document_type === item.expected.document_type
      && item.predicted.capture_layout === item.expected.capture_layout), scored.length),
    mismatchDetection: ratio(mismatchPairs.filter(item => item.predicted.identity_mismatch === true).length, mismatchPairs.length),
    belowCardRead: ratio(belowCard.filter(item => item.predicted.fields[item.belowCardField] === item.expected.fields[item.belowCardField]).length, belowCard.length),
    unsupportedGuesses,
    latencyMs: { p50: percentile(done.map(item => item.latencyMs), 50), p95: percentile(done.map(item => item.latencyMs), 95) },
    tokens,
    costUsdPerSuccess: done.length === 0 ? null : costMicroUsd / 1e6 / done.length,
  }
}

async function loadFixtures() {
  const names = (await readdir(FIXTURE_DIR).catch(() => [])).filter(name => name.endsWith('.json'))
  return Promise.all(names.map(async (name) => {
    const truth = JSON.parse(await readFile(join(FIXTURE_DIR, name), 'utf8'))
    const images = await Promise.all(truth.images.map(async (file) => {
      const extension = file.slice(file.lastIndexOf('.')).toLowerCase()
      if (!MIME[extension]) throw new Error(`Unsupported fixture image type: ${basename(file)}`)
      return { mime: MIME[extension], data: await readFile(join(FIXTURE_DIR, file)) }
    }))
    return { name, images, expected: truth.expected, belowCardField: truth.below_card_field }
  }))
}

async function main() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    throw new Error(`Refusing to run without ${CONFIRM_FLAG}. Fixtures must be fully fictional.`)
  }
  const apiKey = process.env.NUXT_AI_TENANT_ANTHROPIC_API_KEY
  const model = process.env.NUXT_AI_TENANT_VISION_MODEL
  if (!apiKey || !model) throw new Error('Set NUXT_AI_TENANT_ANTHROPIC_API_KEY and NUXT_AI_TENANT_VISION_MODEL.')

  const fixtures = await loadFixtures()
  if (fixtures.length === 0) throw new Error(`No fixtures found in ${FIXTURE_DIR}. See README.md there.`)

  const { createJiti } = await import('jiti')
  const jiti = createJiti(import.meta.url, { alias: { '~': join(root, 'app') } })
  const { extractIdentityWithClaude } = await jiti.import('../server/services/ai/anthropic-vision.ts')
  const { identityExtractionSchema } = await jiti.import('../app/utils/validators/tenant-identity-extraction.ts')

  const samples = []
  for (const fixture of fixtures) {
    const started = performance.now()
    try {
      const result = await extractIdentityWithClaude({ apiKey, model, timeoutMs: 60_000, images: fixture.images })
      const parsed = identityExtractionSchema.safeParse(result.output)
      samples.push({
        ok: true, valid: parsed.success, latencyMs: Math.round(performance.now() - started), usage: result.usage,
        predicted: parsed.success ? parsed.data : null, expected: fixture.expected, belowCardField: fixture.belowCardField,
      })
    }
    catch {
      samples.push({ ok: false, valid: false, latencyMs: 0, usage: { inputTokens: 0, outputTokens: 0 }, predicted: null, expected: fixture.expected })
    }
  }

  const prices = {
    inputPerMTokMicroUsd: Number(process.env.NUXT_AI_TENANT_OCR_INPUT_PRICE_PER_MTOK_MICRO_USD ?? 0),
    outputPerMTokMicroUsd: Number(process.env.NUXT_AI_TENANT_OCR_OUTPUT_PRICE_PER_MTOK_MICRO_USD ?? 0),
  }
  process.stdout.write(`${JSON.stringify({ model, ...aggregateMetrics(samples, prices) }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Benchmark failed.')
    process.exitCode = 1
  })
}
