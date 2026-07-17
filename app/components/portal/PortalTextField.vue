<script setup lang="ts">
import clsx from 'clsx'

const props = withDefaults(defineProps<{
  modelValue: string | null
  label: string
  type?: string
  textarea?: boolean
  placeholder?: string
  error?: string
  inputmode?: 'text' | 'email' | 'tel' | 'numeric'
  rows?: number
  autocomplete?: string
}>(), {
  type: 'text',
  textarea: false,
  rows: 4,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement | HTMLTextAreaElement).value)
}

const fieldClass = computed(() =>
  clsx(
    'w-full rounded-xl border bg-white px-3.5 text-sm text-title transition-colors',
    'placeholder:text-body/50 focus:outline-none focus:ring-2 focus:ring-theme/20',
    props.error ? 'border-error focus:border-error' : 'border-border-light focus:border-theme',
  ),
)
</script>

<template>
  <label class="block space-y-1.5">
    <span class="text-sm font-medium text-title">{{ label }}</span>
    <textarea
      v-if="textarea"
      :value="modelValue ?? ''"
      :rows="rows"
      :placeholder="placeholder"
      :class="[fieldClass, 'py-2.5']"
      @input="onInput"
    />
    <input
      v-else
      :type="type"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :inputmode="inputmode"
      :autocomplete="autocomplete"
      :class="[fieldClass, 'min-h-[44px]']"
      @input="onInput"
    >
    <span v-if="error" class="text-xs text-error">{{ error }}</span>
  </label>
</template>
