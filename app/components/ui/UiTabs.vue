<script setup lang="ts">
import clsx from 'clsx'

export interface UiTabItem {
  key: string
  label: string
  /** Optional count or status hint shown next to the label. */
  count?: number | string
  disabled?: boolean
  /** Reason shown via `title` when disabled. */
  reason?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  tabs: UiTabItem[]
  /**
   * `segmented` renders an iOS-style sliding pill control below `lg` and
   * reverts to the standard underline look at `lg` and above. Mobile-only
   * opt-in; default `underline` is unchanged for every other consumer.
   */
  variant?: 'underline' | 'segmented'
}>(), {
  variant: 'underline',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function select(tab: UiTabItem) {
  if (tab.disabled) return
  if (tab.key !== props.modelValue) emit('update:modelValue', tab.key)
}

const containerClass = computed(() => clsx(
  'flex items-center gap-1 overflow-x-auto no-scrollbar',
  props.variant === 'segmented'
    ? 'rounded-full bg-ui-chrome p-1 lg:rounded-none lg:bg-transparent lg:gap-1 lg:border-b lg:border-ui-border lg:p-0'
    : 'border-b border-ui-border',
))

function tabClass(tab: UiTabItem) {
  const active = tab.key === props.modelValue
  if (props.variant === 'segmented') {
    return clsx(
      'relative inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40',
      'lg:rounded-t-md lg:px-4 lg:py-2.5',
      active
        ? 'bg-ui-surface text-ui-primary shadow-sm lg:bg-transparent lg:text-ui-accent lg:shadow-none'
        : 'text-ui-muted hover:text-ui-primary',
      tab.disabled && 'opacity-50 cursor-not-allowed hover:text-ui-muted',
    )
  }
  return clsx(
    'relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40 rounded-t-md',
    active ? 'text-ui-accent' : 'text-ui-muted hover:text-ui-primary',
    tab.disabled && 'opacity-50 cursor-not-allowed hover:text-ui-muted',
  )
}
</script>

<template>
  <div role="tablist" :class="containerClass">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      role="tab"
      :aria-selected="tab.key === modelValue"
      :aria-disabled="tab.disabled"
      :tabindex="tab.disabled ? -1 : 0"
      :title="tab.disabled ? tab.reason : undefined"
      :class="tabClass(tab)"
      :disabled="tab.disabled"
      @click="select(tab)"
    >
      <span>{{ tab.label }}</span>
      <span
        v-if="tab.count !== undefined && tab.count !== null"
        :class="clsx(
          'rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
          tab.key === modelValue
            ? 'bg-ui-accent/15 text-ui-accent'
            : 'bg-ui-hover text-ui-muted',
        )"
      >
        {{ tab.count }}
      </span>
      <!-- Active indicator: underline-only signature, hidden for the segmented pill below lg -->
      <span
        v-if="tab.key === modelValue"
        :class="clsx(
          'absolute inset-x-0 -bottom-px h-0.5 bg-ui-accent',
          variant === 'segmented' && 'hidden lg:block',
        )"
        aria-hidden="true"
      />
    </button>
  </div>
</template>
