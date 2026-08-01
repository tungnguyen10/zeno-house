<script setup lang="ts">
import { onClickOutside, onKeyStroke } from '@vueuse/core'

withDefaults(defineProps<{
  ariaLabel?: string
}>(), {
  ariaLabel: 'Thêm hành động',
})

const isOpen = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)

function toggle() {
  isOpen.value = !isOpen.value
}

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
      class="inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 size-7 text-xs bg-dark-surface text-white border border-dark-border hover:bg-dark-hover focus-visible:ring-dark-border"
      @click="toggle"
    >
      <IconMoreVertical class="h-4 w-4" aria-hidden="true" />
    </button>
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
        class="absolute right-0 top-full mt-1 z-50 min-w-[10rem] origin-top-right rounded-md border border-dark-border bg-dark-surface shadow-lg py-1"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>
