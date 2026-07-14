import { createHash } from 'node:crypto'
import type { AgentErrorDetails } from '~/types/ai'

type AgentApiErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT' | 'INTERNAL'

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, canonicalize(nested)]),
  )
}

export function hashAgentPayload(
  payload: Record<string, unknown>,
  resourceVersions: Record<string, string>,
): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize({ payload, resourceVersions })))
    .digest('hex')
}

export function throwAgentError(
  statusCode: number,
  code: AgentApiErrorCode,
  message: string,
  details: AgentErrorDetails,
): never {
  throw createError({
    statusCode,
    data: { error: { code, message, details } },
  })
}

export function readAgentErrorDetails(error: unknown): AgentErrorDetails | null {
  if (!error || typeof error !== 'object') return null
  const data = (error as { data?: unknown }).data
  if (!data || typeof data !== 'object') return null
  const envelope = (data as { error?: unknown }).error
  if (!envelope || typeof envelope !== 'object') return null
  const details = (envelope as { details?: unknown }).details
  if (!details || typeof details !== 'object' || typeof (details as { category?: unknown }).category !== 'string') {
    return null
  }
  return details as AgentErrorDetails
}

export function normalizeAgentFailure(error: unknown): Record<string, unknown> {
  const details = readAgentErrorDetails(error)
  if (details) return { category: details.category, retryable: details.retryable }
  return { category: 'INTERNAL_TOOL_FAILURE', retryable: false }
}
