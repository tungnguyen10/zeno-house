<script setup lang="ts">
import { useElementSize } from '@vueuse/core'

/**
 * Shared shell for list-page bulk-selection bars: count badge + "Bỏ chọn" +
 * a slot for domain-specific action buttons. Owns the fixed/sticky
 * positioning — `bottom-[calc(6rem+env(safe-area-inset-bottom))]` clears the
 * mobile tab bar; `lg:sticky lg:bottom-3` matches the desktop layout.
 */
withDefaults(defineProps<{
  count: number
  ariaLabel?: string
}>(), {
  ariaLabel: 'Thao tác hàng loạt',
})

const emit = defineEmits<{
  clear: []
}>()

// Mobile bar is `fixed` (out of flow), so reserve its measured height in the
// normal flow below to stop it permanently covering the last list rows.
const barEl = ref<HTMLElement | null>(null)
const { height: barHeight } = useElementSize(barEl)
</script>

<template>
  <!-- Single root: owns its own enter/leave transition so callers never wrap
       this fragment-shaped component in their own `<Transition>`. -->
  <div>
    <div aria-hidden="true" class="lg:hidden" :style="{ height: `${barHeight}px` }" />
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="count > 0"
        ref="barEl"
        role="region"
        :aria-label="ariaLabel"
        class="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-30 flex flex-col gap-3 rounded-2xl border border-ui-border bg-ui-chrome/95 p-3 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between lg:sticky lg:inset-x-auto lg:bottom-3 lg:rounded-xl lg:bg-ui-surface/95 lg:backdrop-blur"
      >
        <div class="flex items-center gap-3">
          <UiBadge variant="accent">{{ count }} đã chọn</UiBadge>
          <UiButton variant="ghost" size="sm" @click="emit('clear')">Bỏ chọn</UiButton>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <slot />
        </div>

        <slot name="note" />
      </div>
    </Transition>
  </div>
</template>
