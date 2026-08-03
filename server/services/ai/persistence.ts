import type { H3Event } from 'h3'

type AiPersistencePart =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolName: string }
  | { type: 'tool-result'; output: unknown }
  | { type: 'error'; error: unknown }
  | { type: 'abort'; reason?: string }
  | { type: string }

export async function consumeAiPersistence(stream: ReadableStream<AiPersistencePart>) {
  let text = ''
  const tools = new Set<string>()
  const actionPlanIds = new Set<string>()
  let failed = false
  let aborted = false
  const reader = stream.getReader()
  while (true) {
    const { done, value: part } = await reader.read()
    if (done) break
    if (part.type === 'text-delta' && 'text' in part) text += part.text
    else if (part.type === 'tool-call' && 'toolName' in part) tools.add(part.toolName)
    else if (part.type === 'tool-result' && 'output' in part && part.output && typeof part.output === 'object') {
      const actionPlan = (part.output as { actionPlan?: unknown }).actionPlan
      if (actionPlan && typeof actionPlan === 'object' && typeof (actionPlan as { id?: unknown }).id === 'string') {
        actionPlanIds.add((actionPlan as { id: string }).id)
      }
    }
    else if (part.type === 'error' || part.type === 'abort') {
      failed = true
      if (part.type === 'abort') aborted = true
    }
  }
  return { text, tools: [...tools], actionPlanIds: [...actionPlanIds], failed, aborted }
}

export function registerAiPersistence<T>(event: H3Event, promise: Promise<T>): Promise<T> {
  event.waitUntil(promise)
  return promise
}
