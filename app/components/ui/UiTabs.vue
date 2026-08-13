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

const props = defineProps<{
  modelValue: string
  tabs: UiTabItem[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function select(tab: UiTabItem) {
  if (tab.disabled) return
  if (tab.key !== props.modelValue) emit('update:modelValue', tab.key)
}
</script>

<template>
  <div role="tablist" class="flex items-center gap-1 border-b border-ui-border overflow-x-auto no-scrollbar">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      role="tab"
      :aria-selected="tab.key === modelValue"
      :aria-disabled="tab.disabled"
      :tabindex="tab.disabled ? -1 : 0"
      :title="tab.disabled ? tab.reason : undefined"
      :class="clsx(
        'relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40 rounded-t-md',
        tab.key === modelValue
          ? 'text-ui-accent'
          : 'text-ui-muted hover:text-ui-primary',
        tab.disabled && 'opacity-50 cursor-not-allowed hover:text-ui-muted',
      )"
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
      <!-- Active indicator -->
      <span
        v-if="tab.key === modelValue"
        class="absolute inset-x-0 -bottom-px h-0.5 bg-ui-accent"
        aria-hidden="true"
      />
    </button>
  </div>
</template>
