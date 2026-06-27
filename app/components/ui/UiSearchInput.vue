<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  ariaLabel?: string
  /**
   * `compact` — matches `UiSelect`/`UiInput` density="compact" (py-1 text-xs).
   * `normal`  — matches default form sizing (py-2 text-sm).
   */
  density?: 'compact' | 'normal'
  /** Debounce delay before emitting `update:modelValue` (ms). 0 = immediate. */
  debounce?: number
  disabled?: boolean
}>(), {
  density: 'compact',
  debounce: 0,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const local = ref(props.modelValue)

watch(() => props.modelValue, (value) => {
  if (value !== local.value) local.value = value
})

const emitDebounced = props.debounce > 0
  ? useDebounceFn((value: string) => emit('update:modelValue', value), props.debounce)
  : (value: string) => emit('update:modelValue', value)

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  local.value = value
  emitDebounced(value)
}

function onClear() {
  local.value = ''
  emit('update:modelValue', '')
}

const inputClass = computed(() =>
  clsx(
    'block w-full rounded-md border border-dark-border bg-dark-surface pl-9 pr-9',
    'text-white placeholder-muted',
    'focus:border-cyan/70 focus:outline-none focus:ring-2 focus:ring-cyan/30',
    props.density === 'compact' ? 'py-1 text-xs' : 'py-2 text-sm',
    props.disabled && 'cursor-not-allowed opacity-60',
  ),
)
</script>

<template>
  <div class="relative w-full">
    <IconSearch
      class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      aria-hidden="true"
    />
    <input
      type="search"
      :value="local"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      :disabled="disabled"
      :class="inputClass"
      @input="onInput"
    >
    <button
      v-if="local && !disabled"
      type="button"
      class="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-dark-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/30"
      :aria-label="ariaLabel ? `Xoá ${ariaLabel.toLowerCase()}` : 'Xoá tìm kiếm'"
      @click="onClear"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-3 w-3"
        aria-hidden="true"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  </div>
</template>
