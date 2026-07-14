import type { H3Event } from 'h3'

interface AiTelemetryEvent {
  event: 'ai.request' | 'ai.tool' | 'ai.action' | 'ai.rate_limit' | 'ai.circuit' | 'ai.cleanup'
  requestId: string
  conversationId?: string
  durationMs?: number
  outcome?: 'started' | 'succeeded' | 'failed' | 'replayed' | 'rejected'
  toolName?: string
  actionPlanId?: string
  actionType?: string
  model?: string
  errorCategory?: string
}

export function emitAiTelemetry(event: H3Event, value: AiTelemetryEvent): void {
  const payload = {
    ...value,
    route: event.path,
    timestamp: new Date().toISOString(),
  }
  console.warn('[AI_TELEMETRY]', JSON.stringify(payload))
}
