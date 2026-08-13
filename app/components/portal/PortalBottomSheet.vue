<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  title?: string
  ariaLabel?: string
  theme?: 'light' | 'dark'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { resolvedTheme } = usePortalTheme()
const effectiveTheme = computed(() => props.theme ?? resolvedTheme.value)

const dialogRef = ref<HTMLElement | null>(null)
const previousFocus = ref<HTMLElement | null>(null)
const generatedId = useId()
const titleId = computed(() => props.title ? `${generatedId}-title` : undefined)
const accessibleLabel = computed(() => props.title ? undefined : (props.ariaLabel ?? 'Bảng thông tin'))
const dragY = ref(0)
const dragging = ref(false)
let startY = 0

function close() {
  emit('update:modelValue', false)
}

function onPointerDown(event: PointerEvent) {
  dragging.value = true
  startY = event.clientY
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  dragY.value = Math.max(0, event.clientY - startY)
}

function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  if (dragY.value > 120) close()
  dragY.value = 0
}

function focusableElements(): HTMLElement[] {
  if (!dialogRef.value) return []
  return Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(element => element.getAttribute('aria-hidden') !== 'true')
}

function focusDialog() {
  const preferred = dialogRef.value?.querySelector<HTMLElement>('[data-autofocus]:not([disabled])')
  if (preferred) {
    preferred.focus()
    return
  }
  const first = focusableElements()[0]
  if (first) first.focus()
  else dialogRef.value?.focus()
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
    dialogRef.value?.focus()
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

// Lock background scroll while the sheet is open.
watch(
  () => props.modelValue,
  async (open) => {
    if (typeof document === 'undefined') return
    if (open) {
      previousFocus.value = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      await nextTick()
      focusDialog()
    }
    else {
      document.body.style.overflow = ''
      previousFocus.value?.focus?.()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
})

// Dynamic drag transform (gesture-driven, not a static design value).
const sheetStyle = computed(() =>
  dragging.value || dragY.value ? { transform: `translateY(${dragY.value}px)` } : undefined,
)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 motion-reduce:transition-none"
      leave-active-class="transition-opacity duration-200 motion-reduce:transition-none"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[75] bg-black/40"
        aria-hidden="true"
        @click="close"
      />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      leave-active-class="transition-transform duration-200 [transition-timing-function:cubic-bezier(0.32,0,0.67,0)] motion-reduce:transition-none"
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="modelValue"
        ref="dialogRef"
        class="portal-shell portal-safe-bottom fixed inset-x-0 bottom-0 z-[76] rounded-t-3xl bg-white shadow-2xl"
        :data-theme="effectiveTheme"
        :class="{ 'transition-transform duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none': !dragging }"
        :style="sheetStyle"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-labelledby="titleId"
        :aria-label="accessibleLabel"
        @keydown="onKeydown"
      >
        <div
          class="flex touch-none justify-center pt-3"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <span class="h-1.5 w-10 rounded-full bg-smoke" aria-hidden="true" />
        </div>
        <div class="flex items-center justify-between px-5 pb-1 pt-2">
          <h2 :id="titleId" class="text-lg font-semibold text-title">{{ title }}</h2>
          <button
            type="button"
            class="flex h-11 w-11 items-center justify-center rounded-full text-body hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
            aria-label="Đóng"
            @click="close"
          >
            <IconX class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div class="max-h-[75vh] overflow-y-auto px-5 pb-6">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
