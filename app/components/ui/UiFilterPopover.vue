<script setup lang="ts">
import { onClickOutside, onKeyStroke, useMediaQuery } from '@vueuse/core'
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  /** Number of active filters — rendered as a small badge on the trigger. */
  count?: number
  label?: string
  ariaLabel?: string
  /** Popover panel width (Tailwind class). Desktop only. */
  panelClass?: string
}>(), {
  count: 0,
  label: 'Bộ lọc',
  ariaLabel: 'Bộ lọc',
  panelClass: 'w-72',
})

const isOpen = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)

// Below `sm` the fields open in a bottom sheet instead of a trigger-anchored
// popover: the trigger can sit anywhere along the toolbar (left on report
// pages, right of the search box on list pages) and no single anchoring rule
// keeps a 288px panel inside a 390px viewport in both positions.
const isCompact = useMediaQuery('(max-width: 639px)')

const alignEnd = ref(false)

async function open() {
  isOpen.value = true
  if (isCompact.value) return
  await nextTick()
  const trigger = triggerRef.value?.getBoundingClientRect()
  const width = panelRef.value?.offsetWidth ?? 0
  if (!trigger || !width) return
  alignEnd.value = trigger.left + width > window.innerWidth - 16
}

function close() {
  isOpen.value = false
}

function toggle() {
  if (isOpen.value) close()
  else void open()
}

// `UiSelect` teleports its listbox to `body`, so picking an option would
// otherwise register as a click outside the panel and dismiss the filters.
onClickOutside(panelRef, close, { ignore: [triggerRef, '[role="listbox"]'] })
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
      aria-haspopup="dialog"
      :class="clsx(
        'inline-flex h-7 items-center gap-1.5 rounded-md border bg-ui-surface px-3 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/30',
        count > 0
          ? 'border-ui-accent/40 text-ui-primary hover:border-ui-accent/60'
          : 'border-ui-border text-ui-muted hover:text-ui-primary',
      )"
      @click="toggle"
    >
      <span>{{ label }}</span>
      <span
        v-if="count > 0"
        class="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-ui-accent/20 px-1 text-[10px] font-semibold leading-none text-ui-accent"
        aria-hidden="true"
      >
        {{ count }}
      </span>
      <IconChevronDown
        :class="clsx('h-3.5 w-3.5 transition-transform duration-150', isOpen && 'rotate-180')"
        aria-hidden="true"
      />
    </button>

    <UiDrawer
      v-if="isCompact"
      v-model="isOpen"
      :title="label"
      width="w-full"
    >
      <slot :close="close" />
      <template #footer>
        <UiButton class="w-full" @click="close">Xong</UiButton>
      </template>
    </UiDrawer>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-1 scale-95"
    >
      <div
        v-if="isOpen && !isCompact"
        ref="panelRef"
        role="dialog"
        :aria-label="ariaLabel"
        :class="clsx(
          'absolute z-50 mt-2 rounded-xl border border-ui-border bg-ui-chrome p-3 shadow-xl shadow-ui-shadow/40',
          alignEnd ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
          'max-w-[calc(100vw-2rem)]',
          props.panelClass,
        )"
      >
        <slot :close="close" />
      </div>
    </Transition>
  </div>
</template>
