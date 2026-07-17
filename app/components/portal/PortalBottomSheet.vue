<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

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

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

// Lock background scroll while the sheet is open.
watch(
  () => props.modelValue,
  (open) => {
    if (!import.meta.client) return
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
)

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})

// Dynamic drag transform (gesture-driven, not a static design value).
const sheetStyle = computed(() =>
  dragging.value || dragY.value ? { transform: `translateY(${dragY.value}px)` } : undefined,
)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
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
      enter-active-class="transition-transform duration-300 ease-out motion-reduce:transition-none"
      leave-active-class="transition-transform duration-200 ease-in motion-reduce:transition-none"
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="modelValue"
        class="portal-safe-bottom fixed inset-x-0 bottom-0 z-[76] rounded-t-3xl bg-white shadow-2xl"
        :class="{ 'transition-transform duration-200': !dragging }"
        :style="sheetStyle"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="flex touch-none justify-center pt-3"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <span class="h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>
        <div class="flex items-center justify-between px-5 pb-1 pt-2">
          <h2 class="text-lg font-semibold text-title">{{ title }}</h2>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-full text-body transition-colors hover:bg-smoke"
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
