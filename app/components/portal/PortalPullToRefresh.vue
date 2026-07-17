<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Called when the user pulls past the threshold. Resolve to end the spinner. */
  onRefresh: () => Promise<unknown>
  disabled?: boolean
  threshold?: number
}>(), {
  disabled: false,
  threshold: 72,
})

const root = ref<HTMLElement | null>(null)
const pull = ref(0)
const refreshing = ref(false)
const active = ref(false)
let startY = 0
let scrollParent: HTMLElement | null = null

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const overflowY = getComputedStyle(node).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return node
    node = node.parentElement
  }
  return null
}

function onTouchStart(event: TouchEvent) {
  if (props.disabled || refreshing.value) return
  scrollParent = findScrollParent(root.value)
  const top = scrollParent?.scrollTop ?? 0
  if (top > 0) return
  const touch = event.touches[0]
  if (!touch) return
  active.value = true
  startY = touch.clientY
}

function onTouchMove(event: TouchEvent) {
  if (!active.value) return
  const touch = event.touches[0]
  if (!touch) return
  const delta = touch.clientY - startY
  if (delta <= 0) {
    pull.value = 0
    return
  }
  // Rubber-band resistance.
  pull.value = Math.min(delta * 0.5, props.threshold * 1.6)
  if (pull.value > 4 && event.cancelable) event.preventDefault()
}

async function onTouchEnd() {
  if (!active.value) return
  active.value = false
  if (pull.value >= props.threshold) {
    refreshing.value = true
    pull.value = props.threshold
    try {
      await props.onRefresh()
    }
    finally {
      refreshing.value = false
      pull.value = 0
    }
    return
  }
  pull.value = 0
}

const indicatorStyle = computed(() => ({
  transform: `translateY(${pull.value - 36}px)`,
  opacity: pull.value > 6 || refreshing.value ? 1 : 0,
}))

const contentStyle = computed(() => ({
  transform: pull.value ? `translateY(${pull.value}px)` : undefined,
  transition: active.value ? 'none' : 'transform 220ms ease',
}))

const spinnerStyle = computed(() =>
  refreshing.value ? undefined : { transform: `rotate(${(pull.value / props.threshold) * 300}deg)` },
)
</script>

<template>
  <div
    ref="root"
    class="relative"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
  >
    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
      :style="indicatorStyle"
    >
      <span class="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md">
        <IconRefresh
          class="h-5 w-5 text-theme"
          :class="refreshing ? 'animate-spin motion-reduce:animate-none' : ''"
          :style="spinnerStyle"
          aria-hidden="true"
        />
      </span>
    </div>
    <div :style="contentStyle">
      <slot />
    </div>
  </div>
</template>
