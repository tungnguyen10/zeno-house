<script setup lang="ts">
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import type { ComponentPublicInstance } from 'vue'
import type { PendingOperation } from '~/types/dashboard'
import { pendingOperationPath } from '~/utils/routes/operational'
import { formatCurrency } from '~/utils/format/currency'
import { formatPeriodDisplay } from '~/utils/format/period'
import {
  pendingOperationLabel,
  pendingOperationSeverityDotClass,
} from '~/utils/constants/dashboard-operations'

const props = defineProps<{
  items: PendingOperation[]
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const isOpen = ref(false)
const triggerRef = ref<ComponentPublicInstance | HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const visibleItems = computed(() => props.items.slice(0, 5))
const hasMore = computed(() => props.items.length > visibleItems.value.length)

function toggle(): void {
  isOpen.value = !isOpen.value
}

function triggerElement(): HTMLElement | null {
  const target = triggerRef.value
  const element = target instanceof HTMLElement ? target : target?.$el
  return element instanceof HTMLElement ? element : null
}

function interactiveItems(): HTMLElement[] {
  if (!menuRef.value) return []
  return [...menuRef.value.querySelectorAll<HTMLElement>('[data-operation-item], [data-view-all-operations]')]
}

function focusFirstItem(): void {
  nextTick(() => interactiveItems()[0]?.focus())
}

function openFromKeyboard(): void {
  isOpen.value = true
  focusFirstItem()
}

function hasPopoverFocus(): boolean {
  const activeElement = document.activeElement
  return activeElement === document.body
    || activeElement === triggerElement()
    || (activeElement instanceof Node && Boolean(menuRef.value?.contains(activeElement)))
}

function close(restoreFocus = false): void {
  if (!isOpen.value) return
  isOpen.value = false
  if (restoreFocus) {
    nextTick(() => {
      triggerElement()?.focus()
    })
  }
}

function moveMenuFocus(direction: 1 | -1): void {
  if (!isOpen.value) return
  const items = interactiveItems()
  if (!items.length) return
  const currentIndex = items.findIndex(item => item === document.activeElement)
  const nextIndex = currentIndex === -1
    ? (direction === 1 ? 0 : items.length - 1)
    : (currentIndex + direction + items.length) % items.length
  items[nextIndex]?.focus()
}

onClickOutside(menuRef, () => close(), { ignore: [triggerRef] })
onKeyStroke('Escape', () => {
  if (isOpen.value && hasPopoverFocus()) close(true)
})
onKeyStroke('ArrowDown', (event) => {
  if (!isOpen.value || !hasPopoverFocus()) return
  event.preventDefault()
  moveMenuFocus(1)
})
onKeyStroke('ArrowUp', (event) => {
  if (!isOpen.value || !hasPopoverFocus()) return
  event.preventDefault()
  moveMenuFocus(-1)
})
</script>

<template>
  <div class="relative">
    <UiButton
      ref="triggerRef"
      data-operations-trigger
      unstyled
      class="relative flex size-11 items-center justify-center rounded-full border border-ui-border bg-ui-surface/70 text-ui-muted transition-colors hover:border-ui-accent/30 hover:bg-ui-hover hover:text-ui-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40"
      aria-label="Mở việc cần xử lý"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      @click="toggle"
      @keydown.enter.prevent="openFromKeyboard"
      @keydown.space.prevent="openFromKeyboard"
    >
      <IconBell class="h-5 w-5" aria-hidden="true" />
      <span
        v-if="!loading && !error && items.length > 0"
        data-operations-indicator
        class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-ui-accent ring-2 ring-ui-surface"
        aria-hidden="true"
      />
    </UiButton>

    <Transition
      enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
      enter-from-class="-translate-y-1 scale-95 opacity-0"
      enter-to-class="translate-y-0 scale-100 opacity-100"
      leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
      leave-from-class="translate-y-0 scale-100 opacity-100"
      leave-to-class="-translate-y-1 scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        ref="menuRef"
        data-operations-panel
        role="dialog"
        aria-modal="false"
        aria-label="Việc cần xử lý"
        class="fixed inset-x-4 top-16 z-50 w-auto origin-top-right overflow-hidden rounded-xl border border-ui-border bg-ui-chrome shadow-xl shadow-ui-shadow/40 lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-2 lg:w-[22rem]"
      >
        <header class="border-b border-ui-border px-4 py-3">
          <p class="text-sm font-semibold text-ui-primary">Việc cần xử lý</p>
          <p class="mt-0.5 text-xs text-ui-muted">Cảnh báo vận hành trong kỳ hiện tại</p>
        </header>

        <div v-if="loading" class="space-y-2 p-3" aria-label="Đang tải việc cần xử lý">
          <UiSkeleton v-for="i in 3" :key="i" class="h-12 rounded-lg" />
        </div>

        <div v-else-if="error" class="space-y-3 p-4 text-sm">
          <p class="text-status-danger">{{ error }}</p>
          <UiButton
            data-retry-operations
            variant="secondary"
            size="sm"
            @click="emit('refresh')"
          >
            <IconRefresh class="h-4 w-4" aria-hidden="true" />
            Thử lại
          </UiButton>
        </div>

        <div v-else-if="!items.length" class="px-4 py-8 text-center">
          <p class="text-sm font-medium text-ui-primary">Không có việc tồn</p>
          <p class="mt-1 text-xs text-ui-muted">Mọi kỳ vận hành hiện đã ổn.</p>
        </div>

        <div v-else class="divide-y divide-ui-border">
          <NuxtLink
            v-for="item in visibleItems"
            :key="`${item.type}-${item.building.id}-${item.period}`"
            data-operation-item
            :to="pendingOperationPath(item)"
            class="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-ui-hover focus-visible:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-accent/40"
            @click="close()"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="pendingOperationSeverityDotClass(item.severity)"
              aria-hidden="true"
            />
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium text-ui-primary">
                {{ pendingOperationLabel(item.type) }} · {{ item.building.name }}
              </span>
              <span class="mt-0.5 block text-xs text-ui-muted">
                {{ formatPeriodDisplay(item.period) }} · {{ item.count }} mục
              </span>
            </span>
            <span class="flex items-center gap-1 text-xs tabular-nums text-ui-muted group-hover:text-ui-primary">
              <span v-if="item.amount !== undefined">{{ formatCurrency(item.amount) }}</span>
              <IconChevronRight class="h-4 w-4 shrink-0" aria-hidden="true" />
            </span>
          </NuxtLink>
        </div>

        <NuxtLink
          v-if="hasMore"
          data-view-all-operations
          to="/dashboard#pending-operations"
          class="flex min-h-11 items-center justify-center border-t border-ui-border px-4 text-xs font-medium text-ui-accent hover:bg-ui-hover focus-visible:bg-ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-accent/40"
          @click="close()"
        >
          Xem tất cả {{ items.length }} việc cần xử lý
        </NuxtLink>
      </div>
    </Transition>
  </div>
</template>
