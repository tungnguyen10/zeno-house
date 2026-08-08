<script setup lang="ts">
import { onClickOutside, onKeyStroke, StorageSerializers, useDraggable, useStorage, useWindowSize } from '@vueuse/core'
import clsx from 'clsx'
import { renderChatMarkdown } from '~/utils/format/chat-markdown'

interface FabPosition {
  x: number
  y: number
}

const FAB_STORAGE_KEY = 'app-ai-dev-chat-fab-position-v1'
const FAB_SIZE = 48
const FAB_MARGIN = 24
const DRAG_CLICK_THRESHOLD = 4
const WIDGET_WIDTH = 320
const WIDGET_MAX_HEIGHT = 480
const WIDGET_GAP = 12

const open = ref(false)
const fullscreen = ref(false)
const showDebug = ref(false)
const messagesEl = ref<HTMLElement | null>(null)
const widgetEl = ref<HTMLElement | null>(null)
const fabEl = ref<HTMLElement | null>(null)
const suppressFabClick = ref(false)
const dragStartPosition = ref<FabPosition | null>(null)
const runtimeConfig = useRuntimeConfig()
const { width: viewportWidth, height: viewportHeight } = useWindowSize()
// Explicit `object` serializer: a `null` default makes useStorage fall back to
// the plain string serializer, which corrupts stored objects as "[object Object]".
const storedFabPosition = useStorage<FabPosition | null>(FAB_STORAGE_KEY, null, undefined, {
  serializer: StorageSerializers.object,
})

const enabled = computed(() =>
  import.meta.dev || runtimeConfig.public.aiDevChatEnabled === true,
)

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function defaultFabPosition(): FabPosition {
  return {
    x: Math.max(FAB_MARGIN, viewportWidth.value - FAB_SIZE - FAB_MARGIN),
    y: Math.max(FAB_MARGIN, viewportHeight.value - FAB_SIZE - FAB_MARGIN),
  }
}

function clampFabPosition(position: FabPosition): FabPosition {
  return {
    x: clamp(position.x, FAB_MARGIN, Math.max(FAB_MARGIN, viewportWidth.value - FAB_SIZE - FAB_MARGIN)),
    y: clamp(position.y, FAB_MARGIN, Math.max(FAB_MARGIN, viewportHeight.value - FAB_SIZE - FAB_MARGIN)),
  }
}

function syncFabPosition(position: FabPosition) {
  const next = clampFabPosition(position)
  fabX.value = next.x
  fabY.value = next.y
  storedFabPosition.value = next
}

const { x: fabX, y: fabY } = useDraggable(fabEl, {
  initialValue: defaultFabPosition(),
  preventDefault: false,
  stopPropagation: false,
  buttons: [0],
  onStart() {
    // `onStart`'s position arg is pointer-relative to the target, not the
    // absolute drag position `onMove`/`onEnd` use — read the current x/y instead.
    dragStartPosition.value = { x: fabX.value, y: fabY.value }
  },
  onMove(position) {
    const next = clampFabPosition(position)
    if (next.x !== position.x) {
      fabX.value = next.x
    }
    if (next.y !== position.y) {
      fabY.value = next.y
    }
  },
  onEnd(position) {
    const next = clampFabPosition(position)
    fabX.value = next.x
    fabY.value = next.y
    storedFabPosition.value = next

    if (!dragStartPosition.value) {
      return
    }

    const movedX = Math.abs(next.x - dragStartPosition.value.x)
    const movedY = Math.abs(next.y - dragStartPosition.value.y)
    dragStartPosition.value = null

    if (movedX > DRAG_CLICK_THRESHOLD || movedY > DRAG_CLICK_THRESHOLD) {
      suppressFabClick.value = true
      requestAnimationFrame(() => {
        suppressFabClick.value = false
      })
    }
  },
})

const fabStyle = computed(() => ({
  left: `${Math.round(fabX.value)}px`,
  top: `${Math.round(fabY.value)}px`,
}))

// Anchor the widget next to the FAB's current position instead of a fixed
// corner, so a dragged FAB never ends up hidden behind the popup.
const widgetStyle = computed(() => {
  const maxLeft = Math.max(FAB_MARGIN, viewportWidth.value - WIDGET_WIDTH - FAB_MARGIN)
  const maxTop = Math.max(FAB_MARGIN, viewportHeight.value - WIDGET_MAX_HEIGHT - FAB_MARGIN)

  const left = clamp(fabX.value + FAB_SIZE / 2 - WIDGET_WIDTH / 2, FAB_MARGIN, maxLeft)

  const spaceAbove = fabY.value - FAB_MARGIN
  const spaceBelow = viewportHeight.value - (fabY.value + FAB_SIZE) - FAB_MARGIN
  const placeAbove = spaceAbove >= WIDGET_MAX_HEIGHT || spaceAbove >= spaceBelow
  const top = placeAbove
    ? clamp(fabY.value - WIDGET_GAP - WIDGET_MAX_HEIGHT, FAB_MARGIN, maxTop)
    : clamp(fabY.value + FAB_SIZE + WIDGET_GAP, FAB_MARGIN, maxTop)

  return {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
  }
})

const {
  conversationId,
  messages,
  prompt,
  sending,
  canSend,
  lastModel,
  lastProvider,
  lastToolCalls,
  errorCode,
  errorDetails,
  actionErrors,
  actionBusyId,
  actionPlansForMessage,
  send,
  resume,
  confirmAction,
  cancelAction,
  clearChat,
  abort,
} = useAiChat()

onClickOutside(widgetEl, onClose, { ignore: [fabEl] })
onKeyStroke('Escape', () => {
  if (open.value) onClose()
})

onMounted(() => {
  if (storedFabPosition.value) {
    syncFabPosition(storedFabPosition.value)
  }
  else {
    syncFabPosition(defaultFabPosition())
  }

  resume()
})
onBeforeUnmount(() => abort())

watch([viewportWidth, viewportHeight], () => {
  const current = clampFabPosition({ x: fabX.value, y: fabY.value })
  if (current.x !== fabX.value) {
    fabX.value = current.x
  }
  if (current.y !== fabY.value) {
    fabY.value = current.y
  }

  if (!storedFabPosition.value || storedFabPosition.value.x !== current.x || storedFabPosition.value.y !== current.y) {
    storedFabPosition.value = current
  }
})

const toolCallsLabel = computed(() => {
  if (lastToolCalls.value.length === 0) return 'No tool call'
  return lastToolCalls.value.map(tool => tool.name).join(', ')
})

const suggestionGroups = [
  {
    label: 'Kỳ billing',
    suggestions: [
      { id: 'open-period', text: 'Mở kỳ billing hiện tại.' },
      { id: 'period-overview', text: 'Xem tổng quan kỳ billing hiện tại.' },
      { id: 'calculate-draft', text: 'Tính và giải thích billing draft kỳ hiện tại.' },
    ],
  },
  {
    label: 'Chỉ số',
    suggestions: [
      { id: 'meter-status', text: 'Kiểm tra tiến độ nhập chỉ số điện nước kỳ hiện tại.' },
      { id: 'meter-import', text: 'Tôi muốn nhập hàng loạt chỉ số điện nước; hãy yêu cầu tôi dán dữ liệu.' },
      { id: 'meter-update', text: 'Sửa một chỉ số điện nước đã nhập.' },
      { id: 'usage-override', text: 'Điều chỉnh mức tiêu thụ điện nước của một phòng.' },
    ],
  },
  {
    label: 'Hóa đơn',
    suggestions: [
      { id: 'issue-invoices', text: 'Xem trước và phát hành hóa đơn kỳ hiện tại.' },
      { id: 'record-payments', text: 'Ghi thu các phòng còn nợ kỳ hiện tại.' },
      { id: 'void-invoice', text: 'Huỷ một hóa đơn chưa ghi thu.' },
      { id: 'reissue-invoice', text: 'Phát hành lại một hóa đơn đã huỷ.' },
      { id: 'adjust-paid-invoice', text: 'Điều chỉnh một hóa đơn đã ghi thu hoặc ghi thu một phần.' },
    ],
  },
] as const

async function onSend() {
  await send()
  await nextTick()
  messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight, behavior: 'smooth' })
}

async function onSuggestion(text: string) {
  if (sending.value) return
  prompt.value = text
  await onSend()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (canSend.value) onSend()
  }
}

function onClose() {
  abort()
  open.value = false
  fullscreen.value = false
}

function toggleFullscreen() {
  fullscreen.value = !fullscreen.value
}

function onFabClick() {
  if (suppressFabClick.value) {
    return
  }

  open.value = !open.value
}
</script>

<template>
  <ClientOnly>
    <div v-if="enabled">
      <!-- FAB -->
      <button
        v-if="!(open && fullscreen)"
        ref="fabEl"
        type="button"
        class="fixed z-[60] flex size-12 touch-none select-none items-center justify-center rounded-full bg-cyan text-dark-deep shadow-lg transition-transform hover:scale-105 hover:bg-cyan/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2"
        :style="fabStyle"
        :aria-label="open ? 'Đóng AI chat' : 'Mở AI chat'"
        @click="onFabClick"
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
          ref="widgetEl"
          :class="clsx(
            'fixed z-50 flex flex-col rounded-xl border border-dark-border bg-dark-card shadow-xl transition-all duration-200',
            fullscreen ? 'inset-3 sm:inset-6 lg:inset-12' : 'w-80 max-h-[30rem]',
          )"
          :style="fullscreen ? undefined : widgetStyle"
        >
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-dark-border px-4 py-3">
            <div class="flex items-center gap-2">
              <span class="size-2 rounded-full bg-cyan" aria-hidden="true" />
              <span class="text-sm font-semibold text-white">AI Billing Assistant</span>
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
                <IconInfoCircle class="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="flex size-6 items-center justify-center rounded text-muted transition-colors hover:text-white"
                :title="fullscreen ? 'Thu nhỏ' : 'Phóng to toàn màn hình'"
                :aria-label="fullscreen ? 'Thu nhỏ AI chat' : 'Phóng to AI chat toàn màn hình'"
                @click="toggleFullscreen"
              >
                <IconMinimize v-if="fullscreen" class="size-3.5" aria-hidden="true" />
                <IconMaximize v-else class="size-3.5" aria-hidden="true" />
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
            <p><span class="text-white/60">Provider:</span> {{ lastProvider ?? 'N/A' }}</p>
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
            <div v-if="messages.length === 0" class="py-4">
              <p class="text-center text-xs text-muted">
                Chào bạn! Tôi có thể giúp vận hành kỳ billing. Bắt đầu với:
              </p>
              <div class="mt-3 space-y-3">
                <section
                  v-for="group in suggestionGroups"
                  :key="group.label"
                >
                  <h3
                    class="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted"
                  >
                    {{ group.label }}
                  </h3>
                  <ul class="space-y-1.5">
                    <li v-for="suggestion in group.suggestions" :key="suggestion.id">
                      <button
                        type="button"
                        :disabled="sending"
                        :data-testid="`ai-suggestion-${suggestion.id}`"
                        class="w-full rounded-lg border border-dark-border bg-dark-surface px-3 py-2 text-left text-xs text-white/80 transition-colors hover:border-cyan/40 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan/40 disabled:cursor-not-allowed disabled:opacity-50"
                        @click="onSuggestion(suggestion.text)"
                      >
                        {{ suggestion.text }}
                      </button>
                    </li>
                  </ul>
                </section>
              </div>
            </div>
  
            <template
              v-for="(message, index) in messages"
              :key="`${message.role}-${index}`"
            >
              <div
                v-if="message.role === 'user' || message.content.trim()"
                :class="clsx('flex', message.role === 'user' ? 'justify-end' : 'justify-start')"
              >
                <div
                  v-if="message.role === 'user'"
                  class="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-cyan px-3 py-2 text-sm leading-relaxed text-dark-deep"
                >
                  {{ message.content }}
                </div>
                <div
                  v-else
                  class="chat-markdown max-w-[85%] rounded-2xl rounded-bl-sm border border-dark-border bg-dark-surface px-3 py-2 text-sm leading-relaxed text-white"
                  v-html="renderChatMarkdown(message.content)"
                />
              </div>
  
              <AppAiActionCard
                v-for="plan in actionPlansForMessage(message)"
                :key="plan.id"
                :plan="plan"
                :busy="actionBusyId === plan.id"
                :error="actionErrors[plan.id] ?? null"
                @confirm="confirmAction"
                @cancel="cancelAction"
              />
            </template>
  
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
                class="flex-1 resize-none rounded-lg border border-dark-border bg-dark-surface px-3 py-2 text-base sm:text-sm text-white placeholder-muted focus:border-cyan/60 focus:outline-none focus:ring-1 focus:ring-cyan/30 disabled:opacity-50"
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
  </ClientOnly>
</template>

<style scoped lang="scss">
// Typography for AI reply markup rendered via v-html (raw tags, no class hooks available).
.chat-markdown {
  :deep(p + p) { margin-top: 0.5rem; }
  :deep(strong) { font-weight: 600; }
  :deep(ul) {
    margin-top: 0.375rem;
    padding-left: 1.125rem;
    list-style: disc;
  }
  :deep(li + li) { margin-top: 0.25rem; }
  :deep(code) {
    padding: 0.0625rem 0.25rem;
    border-radius: 0.25rem;
    background-color: rgb(255 255 255 / 0.08);
    font-size: 0.8125rem;
  }
  :deep(table) {
    margin-top: 0.5rem;
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  :deep(th),
  :deep(td) {
    border: 1px solid rgb(255 255 255 / 0.12);
    padding: 0.25rem 0.5rem;
    text-align: left;
    vertical-align: top;
  }
  :deep(th) {
    font-weight: 600;
    background-color: rgb(255 255 255 / 0.05);
  }
}
</style>
