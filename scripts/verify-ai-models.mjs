import { pathToFileURL } from 'node:url'

const DEFAULT_PRIMARY = 'nvidia/nemotron-3-super-120b-a12b:free'
const DEFAULT_FALLBACK = 'google/gemma-4-31b-it:free'

export function validateModelCatalog(models, primary, fallback) {
  if (!primary.endsWith(':free') || !fallback.endsWith(':free')) {
    throw new Error('Both AI models must use explicit :free variants.')
  }
  if (primary === fallback) throw new Error('Primary and fallback AI models must be different.')

  for (const id of [primary, fallback]) {
    const entry = models.find(model => model.id === id)
    if (!entry) throw new Error(`Model missing from OpenRouter catalog: ${id}`)
    if (Number(entry.pricing?.prompt) !== 0 || Number(entry.pricing?.completion) !== 0) {
      throw new Error(`Model is not zero-cost: ${id}`)
    }
    if (!entry.supported_parameters?.includes('tools')) {
      throw new Error(`Model does not support tools: ${id}`)
    }
  }
  return { primary, fallback }
}

export async function verifyConfiguredModels({
  primary = process.env.NUXT_AI_MODEL || DEFAULT_PRIMARY,
  fallback = process.env.NUXT_AI_MODEL_FALLBACK || DEFAULT_FALLBACK,
  fetchImpl = fetch,
} = {}) {
  const response = await fetchImpl('https://openrouter.ai/api/v1/models?supported_parameters=tools', {
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`OpenRouter catalog returned HTTP ${response.status}.`)
  const body = await response.json()
  return validateModelCatalog(Array.isArray(body?.data) ? body.data : [], primary, fallback)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyConfiguredModels()
    .then(({ primary, fallback }) => {
      console.log(`Verified zero-cost AI routing: ${primary} -> ${fallback}`)
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'AI model verification failed.')
      process.exitCode = 1
    })
}
