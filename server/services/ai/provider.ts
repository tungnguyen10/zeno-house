import type { AiMessageRole } from '~/types/ai'

export const DEFAULT_AI_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free'
export const DEFAULT_AI_FALLBACK_MODEL = 'google/gemma-4-31b-it:free'

export interface AiProviderConfig {
  provider: string
  openrouterApiKey: string
  googleApiKey: string
  siteUrl: string
  modelPrimary: string
  modelFallback: string
  allowPaidPrimary: boolean
  maxSteps: number
  maxOutputTokens: number
  maxContextMessages: number
  maxContextChars: number
}

interface RuntimeLike {
  aiProvider?: unknown
  aiOpenrouterApiKey?: unknown
  aiGoogleApiKey?: unknown
  aiModel?: unknown
  aiModelFallback?: unknown
  aiAllowPaidPrimary?: unknown
  aiMaxSteps?: unknown
  aiMaxOutputTokens?: unknown
  aiMaxContextMessages?: unknown
  aiMaxContextChars?: unknown
  public?: { siteUrl?: unknown }
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback
}

export function resolveAiProviderConfig(runtime: RuntimeLike, production: boolean): AiProviderConfig {
  const provider = typeof runtime.aiProvider === 'string' && runtime.aiProvider ? runtime.aiProvider : 'openrouter'
  const modelPrimary = typeof runtime.aiModel === 'string' && runtime.aiModel ? runtime.aiModel : DEFAULT_AI_MODEL
  const modelFallback = typeof runtime.aiModelFallback === 'string' && runtime.aiModelFallback
    ? runtime.aiModelFallback
    : DEFAULT_AI_FALLBACK_MODEL
  const allowPaidPrimary = runtime.aiAllowPaidPrimary === true

  if (provider === 'openrouter') {
    if (production && !modelFallback.endsWith(':free')) {
      throw new Error('Production AI fallback model must use an explicit :free variant.')
    }
    if (production && !allowPaidPrimary && !modelPrimary.endsWith(':free')) {
      throw new Error('Production AI primary model must use an explicit :free variant unless paid primary is enabled.')
    }
    if (modelPrimary === modelFallback) throw new Error('Primary and fallback AI models must be different.')
  }

  return {
    provider,
    openrouterApiKey: typeof runtime.aiOpenrouterApiKey === 'string' ? runtime.aiOpenrouterApiKey : '',
    googleApiKey: typeof runtime.aiGoogleApiKey === 'string' ? runtime.aiGoogleApiKey : '',
    siteUrl: typeof runtime.public?.siteUrl === 'string' ? runtime.public.siteUrl : '',
    modelPrimary,
    modelFallback,
    allowPaidPrimary,
    maxSteps: positiveInteger(runtime.aiMaxSteps, 8),
    maxOutputTokens: positiveInteger(runtime.aiMaxOutputTokens, 1200),
    maxContextMessages: positiveInteger(runtime.aiMaxContextMessages, 20),
    maxContextChars: positiveInteger(runtime.aiMaxContextChars, 12_000),
  }
}

export function buildOpenRouterProviderOptions(config: AiProviderConfig) {
  return {
    openrouter: {
      models: [config.modelFallback],
      provider: {
        allow_fallbacks: true,
        data_collection: 'deny',
        require_parameters: true,
      },
    },
  }
}

export function resolveModelRoute(config: AiProviderConfig, selectedModel?: string) {
  const selected = selectedModel || config.modelPrimary
  return {
    requestedModel: config.modelPrimary,
    selectedModel: selected,
    fallbackUsed: selected !== config.modelPrimary,
  }
}

export function selectBoundedHistory<T extends { role: AiMessageRole; content: string }>(
  history: T[],
  limits: { maxMessages: number; maxChars: number },
): T[] {
  const selected: T[] = []
  let chars = 0
  for (let index = history.length - 1; index >= 0 && selected.length < limits.maxMessages; index -= 1) {
    const message = history[index]
    if (!message) continue
    const isCurrent = index === history.length - 1
    if (!isCurrent && chars + message.content.length > limits.maxChars) break
    selected.unshift(message)
    chars += message.content.length
  }
  return selected
}
