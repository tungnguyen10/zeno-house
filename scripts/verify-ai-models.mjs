import { pathToFileURL } from 'node:url'

const DEFAULT_PRIMARY = 'nvidia/nemotron-3-super-120b-a12b:free'
const DEFAULT_FALLBACK = 'google/gemma-4-31b-it:free'

export function validateModelCatalog(models, primary, fallback, allowPaidPrimary = false) {
  if (!fallback.endsWith(':free')) throw new Error('Fallback model must use an explicit :free variant.')
  if (!allowPaidPrimary && !primary.endsWith(':free')) {
    throw new Error('Primary model must be zero-cost unless paid-primary opt-in is enabled.')
  }
  if (primary === fallback) throw new Error('Primary and fallback AI models must be different.')

  for (const [role, id] of [['primary', primary], ['fallback', fallback]]) {
    const entry = models.find(model => model.id === id)
    if (!entry) throw new Error(`Model missing from OpenRouter catalog: ${id}`)
    if ((role === 'fallback' || !allowPaidPrimary)
      && (Number(entry.pricing?.prompt) !== 0 || Number(entry.pricing?.completion) !== 0)) {
      throw new Error(`${role === 'fallback' ? 'Fallback' : 'Primary'} model is not zero-cost: ${id}`)
    }
    if (!entry.supported_parameters?.includes('tools')) {
      throw new Error(`Model does not support tools: ${id}`)
    }
  }
  return { primary, fallback, allowPaidPrimary }
}

export async function verifyConfiguredModels({
  primary = process.env.NUXT_AI_MODEL || DEFAULT_PRIMARY,
  fallback = process.env.NUXT_AI_MODEL_FALLBACK || DEFAULT_FALLBACK,
  allowPaidPrimary = process.env.NUXT_AI_ALLOW_PAID_PRIMARY === 'true',
  fetchImpl = fetch,
} = {}) {
  const response = await fetchImpl('https://openrouter.ai/api/v1/models?supported_parameters=tools', {
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`OpenRouter catalog returned HTTP ${response.status}.`)
  const body = await response.json()
  return validateModelCatalog(Array.isArray(body?.data) ? body.data : [], primary, fallback, allowPaidPrimary)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyConfiguredModels()
    .then(({ primary, fallback, allowPaidPrimary }) => {
      process.stdout.write(`Verified AI routing: ${primary} -> ${fallback} (paid primary: ${allowPaidPrimary ? 'enabled' : 'disabled'})\n`)
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'AI model verification failed.')
      process.exitCode = 1
    })
}
