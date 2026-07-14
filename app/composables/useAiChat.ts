import type { AiActionPlanDto, AiConversationTranscript, AiStreamEvent } from '~/types/ai'
import { getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

interface ToolCallSummary {
  name: string
  status: 'started' | 'succeeded' | 'failed'
  durationMs?: number
}

const STORAGE_KEY = 'zeno-ai-conversation-id'

export function parseAiSseFrames(buffer: string): { events: AiStreamEvent[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const frames = normalized.split('\n\n')
  const remainder = frames.pop() ?? ''
  const events: AiStreamEvent[] = []
  for (const frame of frames) {
    const data = frame.split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart())
      .join('\n')
    if (!data) continue
    try {
      events.push(JSON.parse(data) as AiStreamEvent)
    }
    catch {
      // A malformed server frame is ignored; a later structured error/done
      // event still terminates the request deterministically.
    }
  }
  return { events, remainder }
}

export function useAiChat() {
  const conversationId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const actionPlans = ref<AiActionPlanDto[]>([])
  const prompt = ref('')
  const sending = ref(false)
  const resuming = ref(false)

  const lastModel = ref<string | null>(null)
  const lastRequestId = ref<string | null>(null)
  const lastToolCalls = ref<ToolCallSummary[]>([])

  const errorMessage = ref<string | null>(null)
  const errorCode = ref<string | null>(null)
  const errorDetails = ref<unknown>(null)

  const canSend = computed(() => prompt.value.trim().length > 0 && !sending.value)

  function upsertPlan(plan: AiActionPlanDto) {
    const index = actionPlans.value.findIndex(item => item.id === plan.id)
    if (index === -1) actionPlans.value.push(plan)
    else actionPlans.value[index] = plan
  }

  function applyEvent(event: AiStreamEvent, assistantIndex: number) {
    if (event.type === 'text-delta') {
      const placeholder = messages.value[assistantIndex]
      if (placeholder) placeholder.content += event.text
    }
    else if (event.type === 'tool-status') {
      const index = lastToolCalls.value.findIndex(item => item.name === event.tool)
      const summary = { name: event.tool, status: event.status, ...(event.durationMs !== undefined && { durationMs: event.durationMs }) }
      if (index === -1) lastToolCalls.value.push(summary)
      else lastToolCalls.value[index] = summary
    }
    else if (event.type === 'action-plan') {
      upsertPlan(event.plan)
    }
    else if (event.type === 'error') {
      errorMessage.value = event.error.message
      errorCode.value = event.error.code
      errorDetails.value = event.error.details ?? null
    }
    else if (event.type === 'done') {
      conversationId.value = event.conversationId
      lastRequestId.value = event.requestId
      lastModel.value = event.model
      if (import.meta.client) sessionStorage.setItem(STORAGE_KEY, event.conversationId)
    }
  }

  async function send() {
    const content = prompt.value.trim()
    if (!content || sending.value) return

    errorMessage.value = null
    errorCode.value = null
    errorDetails.value = null
    lastToolCalls.value = []
    messages.value.push({ role: 'user', content })
    prompt.value = ''
    sending.value = true
    messages.value.push({ role: 'assistant', content: '' })
    const assistantIndex = messages.value.length - 1

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conversationId.value ?? undefined, message: content }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw err
      }
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Không nhận được dữ liệu từ máy chủ.')

      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parsed = parseAiSseFrames(buffer)
        buffer = parsed.remainder
        for (const event of parsed.events) applyEvent(event, assistantIndex)
      }
      buffer += decoder.decode()
      const parsed = parseAiSseFrames(`${buffer}\n\n`)
      for (const event of parsed.events) applyEvent(event, assistantIndex)

      const final = messages.value[assistantIndex]
      if (final && !final.content.trim()) final.content = errorMessage.value ? `Lỗi: ${errorMessage.value}` : '(No response)'
    }
    catch (error) {
      errorMessage.value = getApiErrorMessage(error, 'Không thể gọi trợ lý AI.')
      errorCode.value = getApiErrorCode(error) ?? null
      errorDetails.value = getApiErrorDetails(error) ?? null
      const placeholder = messages.value[assistantIndex]
      if (placeholder) placeholder.content = `Lỗi: ${errorMessage.value}`
    }
    finally {
      sending.value = false
    }
  }

  async function resume() {
    if (!import.meta.client || resuming.value || messages.value.length > 0) return
    const storedId = sessionStorage.getItem(STORAGE_KEY)
    if (!storedId) return
    resuming.value = true
    try {
      const response = await $fetch<{ data: AiConversationTranscript }>(`/api/ai/conversations/${storedId}`)
      conversationId.value = response.data.conversation.id
      messages.value = response.data.messages.map(message => ({ role: message.role, content: message.content }))
      actionPlans.value = response.data.actionPlans
    }
    catch {
      sessionStorage.removeItem(STORAGE_KEY)
    }
    finally {
      resuming.value = false
    }
  }

  async function confirmAction(planId: string) {
    const response = await $fetch<{ data: AiActionPlanDto }>(`/api/ai/actions/${planId}/confirm`, { method: 'POST' })
    upsertPlan(response.data)
  }

  async function cancelAction(planId: string) {
    const response = await $fetch<{ data: AiActionPlanDto }>(`/api/ai/actions/${planId}/cancel`, { method: 'POST' })
    upsertPlan(response.data)
  }

  function clearChat() {
    conversationId.value = null
    messages.value = []
    actionPlans.value = []
    prompt.value = ''
    lastModel.value = null
    lastRequestId.value = null
    lastToolCalls.value = []
    errorMessage.value = null
    errorCode.value = null
    errorDetails.value = null
    if (import.meta.client) sessionStorage.removeItem(STORAGE_KEY)
  }

  return {
    conversationId, messages, actionPlans, prompt, sending, resuming, canSend,
    lastModel, lastRequestId, lastToolCalls, errorMessage, errorCode, errorDetails,
    send, resume, confirmAction, cancelAction, clearChat,
  }
}
