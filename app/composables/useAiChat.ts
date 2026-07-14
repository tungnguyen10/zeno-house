import { getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

interface ToolCallSummary {
  name: string
}

export function useAiChat() {
  const conversationId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const prompt = ref('')
  const sending = ref(false)

  const lastModel = ref<string | null>(null)
  const lastRequestId = ref<string | null>(null)
  const lastToolCalls = ref<ToolCallSummary[]>([])

  const errorMessage = ref<string | null>(null)
  const errorCode = ref<string | null>(null)
  const errorDetails = ref<unknown>(null)

  const canSend = computed(() => prompt.value.trim().length > 0 && !sending.value)

  async function send() {
    const content = prompt.value.trim()
    if (!content || sending.value) return

    errorMessage.value = null
    errorCode.value = null
    errorDetails.value = null

    messages.value.push({ role: 'user', content })
    prompt.value = ''
    sending.value = true

    const chatId = conversationId.value ?? crypto.randomUUID()
    conversationId.value = chatId

    // Add empty assistant message as streaming placeholder
    messages.value.push({ role: 'assistant', content: '' })
    const assistantIndex = messages.value.length - 1

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: chatId,
          messages: messages.value.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        }),
      })

      lastModel.value = response.headers.get('X-AI-Model')
      lastRequestId.value = response.headers.get('X-Request-Id')

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        errorMessage.value = getApiErrorMessage(err, 'Không thể gọi trợ lý AI.')
        errorCode.value = getApiErrorCode(err) ?? null
        errorDetails.value = getApiErrorDetails(err) ?? null
        const placeholder = messages.value[assistantIndex]
        if (placeholder) placeholder.content = `Lỗi: ${errorMessage.value}`
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        const placeholder = messages.value[assistantIndex]
        if (placeholder) placeholder.content = 'Lỗi: Không nhận được dữ liệu từ máy chủ.'
        return
      }

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const placeholder = messages.value[assistantIndex]
        if (placeholder) placeholder.content += decoder.decode(value, { stream: true })
      }
      // Flush remaining bytes and apply empty-response fallback
      const remaining = decoder.decode()
      if (remaining) {
        const placeholder = messages.value[assistantIndex]
        if (placeholder) placeholder.content += remaining
      }
      const final = messages.value[assistantIndex]
      if (final && !final.content.trim()) {
        final.content = '(No response)'
      }
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

  function clearChat() {
    conversationId.value = null
    messages.value = []
    prompt.value = ''
    lastModel.value = null
    lastRequestId.value = null
    lastToolCalls.value = []
    errorMessage.value = null
    errorCode.value = null
    errorDetails.value = null
  }

  return {
    conversationId,
    messages,
    prompt,
    sending,
    canSend,
    lastModel,
    lastRequestId,
    lastToolCalls,
    errorMessage,
    errorCode,
    errorDetails,
    send,
    clearChat,
  }
}