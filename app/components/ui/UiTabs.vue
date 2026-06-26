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
  <div role="tablist" class="flex items-center gap-1 border-b border-dark-border overflow-x-auto no-scrollbar">
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
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40 rounded-t-md',
        tab.key === modelValue
          ? 'text-cyan'
          : 'text-muted hover:text-white',
        tab.disabled && 'opacity-50 cursor-not-allowed hover:text-muted',
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
            ? 'bg-cyan/15 text-cyan'
            : 'bg-dark-hover text-muted',
        )"
      >
        {{ tab.count }}
      </span>
      <!-- Active indicator -->
      <span
        v-if="tab.key === modelValue"
        class="absolute inset-x-0 -bottom-px h-0.5 bg-cyan"
        aria-hidden="true"
      />
    </button>
  </div>
</template>
