<script setup lang="ts">
import clsx from 'clsx'

const open = ref(false)
const showDebug = ref(false)
const messagesEl = ref<HTMLElement | null>(null)
const runtimeConfig = useRuntimeConfig()

const enabled = computed(() =>
  import.meta.dev || runtimeConfig.public.aiDevChatEnabled === true,
)

const {
  conversationId,
  messages,
  prompt,
  sending,
  canSend,
  lastModel,
  lastToolCalls,
  errorCode,
  errorDetails,
  send,
  clearChat,
} = useAiChat()

const toolCallsLabel = computed(() => {
  if (lastToolCalls.value.length === 0) return 'No tool call'
  return lastToolCalls.value.map(tool => tool.name).join(', ')
})

async function onSend() {
  await send()
  await nextTick()
  messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight, behavior: 'smooth' })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (canSend.value) onSend()
  }
}

function onClose() {
  open.value = false
}
</script>

<template>
  <div v-if="enabled">
    <!-- FAB -->
    <button
      type="button"
      class="fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full bg-cyan text-dark-deep shadow-lg transition-transform hover:scale-105 hover:bg-cyan/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2"
      :aria-label="open ? 'Đóng AI chat' : 'Mở AI chat'"
      @click="open = !open"
    >
      <IconX v-if="open" class="size-5" aria-hidden="true" />
      <IconMessageCircle v-else class="size-5" aria-hidden="true" />
    </button>

    <!-- Widget popup -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-3 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-3 scale-95"
    >
      <div
        v-if="open"
        class="fixed bottom-[5.5rem] right-6 z-50 flex w-80 flex-col rounded-xl border border-dark-border bg-dark-card shadow-xl"
        style="max-height: 480px;"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-dark-border px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="size-2 rounded-full bg-cyan" aria-hidden="true" />
            <span class="text-sm font-semibold text-white">AI Dev Chat</span>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              :class="clsx(
                'flex size-6 items-center justify-center rounded text-xs transition-colors',
                showDebug ? 'text-cyan' : 'text-muted hover:text-white',
              )"
              :title="showDebug ? 'Ẩn debug info' : 'Hiện debug info'"
              @click="showDebug = !showDebug"
            >
              <IconInfo class="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded text-muted transition-colors hover:text-white"
              title="Xóa hội thoại"
              :disabled="sending"
              @click="clearChat"
            >
              <IconTrash class="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded text-muted transition-colors hover:text-white"
              title="Đóng"
              @click="onClose"
            >
              <IconX class="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <!-- Debug meta (collapsible) -->
        <div
          v-if="showDebug"
          class="border-b border-dark-border bg-dark-surface px-3 py-2 text-xs text-muted space-y-0.5"
        >
          <p><span class="text-white/60">Model:</span> {{ lastModel ?? 'N/A' }}</p>
          <p><span class="text-white/60">Conv:</span> {{ conversationId ? conversationId.slice(0, 8) + '…' : 'N/A' }}</p>
          <p><span class="text-white/60">Tools:</span> {{ toolCallsLabel }}</p>
          <p v-if="errorCode" class="text-red-400"><span class="text-white/60">Error:</span> {{ errorCode }}</p>
          <p v-if="errorDetails" class="break-all text-red-400/80">{{ typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails) }}</p>
        </div>

        <!-- Messages -->
        <div
          ref="messagesEl"
          class="flex-1 overflow-y-auto px-3 py-3 space-y-2"
          style="min-height: 0;"
        >
          <p v-if="messages.length === 0" class="text-center text-xs text-muted py-6">
            Gửi một prompt để bắt đầu.
          </p>

          <div
            v-for="(message, index) in messages"
            :key="`${message.role}-${index}`"
            :class="clsx('flex', message.role === 'user' ? 'justify-end' : 'justify-start')"
          >
            <div
              :class="clsx(
                'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed',
                message.role === 'user'
                  ? 'rounded-br-sm bg-cyan text-dark-deep'
                  : 'rounded-bl-sm bg-dark-surface border border-dark-border text-white',
              )"
            >
              {{ message.content }}
            </div>
          </div>

          <!-- Typing indicator -->
          <div v-if="sending" class="flex justify-start">
            <div class="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-dark-border bg-dark-surface px-3 py-2.5">
              <span class="size-1.5 animate-bounce rounded-full bg-muted" style="animation-delay: 0ms" />
              <span class="size-1.5 animate-bounce rounded-full bg-muted" style="animation-delay: 150ms" />
              <span class="size-1.5 animate-bounce rounded-full bg-muted" style="animation-delay: 300ms" />
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="border-t border-dark-border px-3 py-2.5">
          <div class="flex items-end gap-2">
            <textarea
              v-model="prompt"
              rows="1"
              placeholder="Nhập tin nhắn…"
              :disabled="sending"
              class="flex-1 resize-none rounded-lg border border-dark-border bg-dark-surface px-3 py-2 text-sm text-white placeholder-muted focus:border-cyan/60 focus:outline-none focus:ring-1 focus:ring-cyan/30 disabled:opacity-50"
              style="max-height: 96px; overflow-y: auto;"
              @keydown="onKeydown"
            />
            <button
              type="button"
              :disabled="!canSend"
              class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan text-dark-deep transition-colors hover:bg-cyan/90 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Gửi"
              @click="onSend"
            >
              <IconSend class="size-4" aria-hidden="true" />
            </button>
          </div>
          <p class="mt-1 text-center text-[10px] text-muted/60">Enter gửi · Shift+Enter xuống dòng</p>
        </div>
      </div>
    </Transition>
  </div>
</template>
