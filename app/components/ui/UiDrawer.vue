<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  ariaLabel?: string
  width?: string
}>(), {
  width: 'w-96',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const drawerRef = ref<HTMLElement | null>(null)
const previousFocus = ref<HTMLElement | null>(null)
// Keep body teleports out of SSR so their anchors cannot conflict with other
// teleported UI (for example, the global toast host) during hydration.
const mounted = ref(false)
const generatedId = useId()
const titleId = computed(() => props.title ? `${generatedId}-title` : undefined)
const accessibleLabel = computed(() => props.title ? undefined : (props.ariaLabel ?? 'Ngăn chi tiết'))

// Below `lg` this renders as a bottom sheet (native-style, drag-to-dismiss);
// at `lg+` it keeps the original right-side drawer.
const panelClass = computed(() =>
  clsx(
    'fixed inset-x-0 bottom-0 z-10 flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-ui-chrome shadow-2xl safe-bottom',
    // `inset-x-0` + a fixed width would pin the sheet to the left edge on tablets.
    'mx-auto',
    'lg:inset-x-auto lg:inset-y-0 lg:bottom-auto lg:right-0 lg:h-full lg:max-h-full lg:rounded-t-none lg:shadow-xl',
    'sm:max-w-full',
    props.width,
  ),
)

const dragY = ref(0)
const dragging = ref(false)
let startY = 0

function close() {
  emit('update:modelValue', false)
}

function onHandlePointerDown(event: PointerEvent) {
  dragging.value = true
  startY = event.clientY
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onHandlePointerMove(event: PointerEvent) {
  if (!dragging.value) return
  dragY.value = Math.max(0, event.clientY - startY)
}

function onHandlePointerUp() {
  if (!dragging.value) return
  dragging.value = false
  if (dragY.value > 120) close()
  dragY.value = 0
}

// Drag offset for the mobile sheet handle; unused (0) when not dragging.
const panelStyle = computed(() =>
  dragging.value || dragY.value ? { transform: `translateY(${dragY.value}px)` } : undefined,
)

onMounted(() => { mounted.value = true })

function focusableElements(): HTMLElement[] {
  if (!drawerRef.value) return []
  return Array.from(
    drawerRef.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab') return
  const items = focusableElements()
  if (items.length === 0) {
    event.preventDefault()
    drawerRef.value?.focus()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      previousFocus.value = document.activeElement as HTMLElement | null
      await nextTick()
      const first = focusableElements()[0]
      if (first) first.focus()
      else drawerRef.value?.focus()
    }
    else {
      previousFocus.value?.focus?.()
    }
  },
)
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[65]"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-label="accessibleLabel"
        @keydown="onKeydown"
      >
        <!-- Above the AI FAB (z-60) so an open sheet never sits under it, below the toast host (z-70). -->
        <div class="absolute inset-0 bg-ui-overlay/50" aria-hidden="true" @click="close" />

        <Transition
          appear
          enter-active-class="transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          enter-from-class="translate-y-full translate-x-0 lg:translate-y-0 lg:translate-x-full"
          enter-to-class="translate-y-0 translate-x-0"
          leave-active-class="transition-transform duration-200 [transition-timing-function:cubic-bezier(0.32,0,0.67,0)] motion-reduce:transition-none"
          leave-from-class="translate-y-0 translate-x-0"
          leave-to-class="translate-y-full translate-x-0 lg:translate-y-0 lg:translate-x-full"
        >
          <aside
            v-if="modelValue"
            ref="drawerRef"
            :class="[panelClass, { 'transition-transform duration-200 motion-reduce:transition-none': !dragging }]"
            :style="panelStyle"
            tabindex="-1"
          >
            <!-- Drag handle — mobile bottom-sheet only, hidden on the desktop drawer. -->
            <div
              class="flex touch-none justify-center pb-1 pt-2.5 lg:hidden"
              @pointerdown="onHandlePointerDown"
              @pointermove="onHandlePointerMove"
              @pointerup="onHandlePointerUp"
              @pointercancel="onHandlePointerUp"
            >
              <span class="h-1.5 w-10 rounded-full bg-ui-border-strong" aria-hidden="true" />
            </div>

            <header class="flex items-center justify-between border-b border-ui-border px-5 py-4">
              <div :id="titleId" class="min-w-0">
                <slot name="header">
                  <h2 class="text-base font-semibold text-ui-primary">{{ title }}</h2>
                </slot>
              </div>
              <UiButton variant="ghost" size="sm" icon-only aria-label="Đóng" @click="close">
                <IconX class="h-4 w-4" aria-hidden="true" />
              </UiButton>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <slot />
            </div>

            <footer v-if="$slots.footer" class="border-t border-ui-border px-5 py-4">
              <slot name="footer" />
            </footer>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

