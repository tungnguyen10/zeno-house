<script setup lang="ts">
const props = defineProps<{
  loading?: boolean
  disabled?: boolean
  variant?: 'default' | 'danger'
  title?: string
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()

const close = inject<() => void>('dropdownClose', () => {})

function handleClick() {
  if (props.disabled || props.loading) return
  emit('click')
  close()
}
</script>

<template>
  <button
    type="button"
    role="menuitem"
    :title="title"
    :disabled="disabled || loading"
    :class="[
      'flex w-full items-center gap-2 px-3 py-2 text-sm text-left whitespace-nowrap hover:bg-dark-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
      variant === 'danger' ? 'text-rose-400' : 'text-white',
    ]"
    @click="handleClick"
  >
    <IconSpinner v-if="loading" class="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
    <slot v-else name="icon" />
    <slot />
    <slot name="trailing" />
  </button>
</template>
