<script setup lang="ts">
import clsx from 'clsx'
import { onClickOutside, onKeyStroke, useEventListener } from '@vueuse/core'

const props = withDefaults(defineProps<{
  ariaLabel?: string
  /** Extra classes on the trigger button — e.g. `min-h-11 min-w-11` for a mobile 44px touch target. */
  triggerClass?: string
}>(), {
  ariaLabel: 'Thêm hành động',
})

const isOpen = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)

const triggerClasses = computed(() => clsx(
  'inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 size-7 text-xs bg-ui-surface text-ui-primary border border-ui-border hover:bg-ui-hover focus-visible:ring-ui-border-strong',
  props.triggerClass,
))

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    positionPanel()
    nextTick(positionPanel)
  }
}

const panelStyle = ref<Record<string, string>>({})

// Panel is teleported to <body>, so overflow-hidden ancestors cannot clip it.
function positionPanel() {
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const panelHeight = panelRef.value?.offsetHeight ?? 0
  const gap = 4
  const flipUp = panelHeight > 0
    && rect.bottom + gap + panelHeight > window.innerHeight
    && rect.top - gap - panelHeight > 0
  panelStyle.value = {
    right: `${Math.max(8, window.innerWidth - rect.right)}px`,
    top: flipUp ? `${rect.top - gap - panelHeight}px` : `${rect.bottom + gap}px`,
  }
}

useEventListener(window, 'resize', () => { if (isOpen.value) close() })
useEventListener(window, 'scroll', () => { if (isOpen.value) close() }, { capture: true, passive: true })

function close() {
  isOpen.value = false
}

provide('dropdownClose', close)

onClickOutside(panelRef, close, { ignore: [triggerRef] })
onKeyStroke('Escape', () => {
  if (isOpen.value) close()
})
</script>

<template>
  <div class="relative">
    <button
      ref="triggerRef"
      type="button"
      :aria-expanded="isOpen"
      :aria-label="ariaLabel"
      aria-haspopup="menu"
      :class="triggerClasses"
      @click="toggle"
    >
      <IconMoreVertical class="h-4 w-4" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="isOpen"
          ref="panelRef"
          role="menu"
          :style="panelStyle"
          class="fixed z-50 min-w-[10rem] origin-top-right rounded-md border border-ui-border bg-ui-surface shadow-lg py-1"
        >
          <slot />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
