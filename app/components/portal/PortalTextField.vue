<script setup lang="ts">
import clsx from 'clsx'
import { useId } from 'vue'

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
  id?: string
  name?: string
  hint?: string
  disabled?: boolean
  required?: boolean
}>(), {
  type: 'text',
  textarea: false,
  rows: 4,
  disabled: false,
  required: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement | HTMLTextAreaElement).value)
}

const generatedId = useId()
const fieldId = computed(() => props.id ?? `portal-field-${generatedId}`)
const feedbackId = computed(() => props.error
  ? `${fieldId.value}-error`
  : props.hint
    ? `${fieldId.value}-hint`
    : undefined)

const fieldClass = computed(() =>
  clsx(
    'w-full rounded-xl border bg-white px-3.5 text-sm text-title transition-colors',
    'placeholder:text-portal-muted focus:outline-none focus:border-theme',
    'focus-visible:ring-2 focus-visible:ring-theme/20',
    props.error
      ? 'border-portal-danger focus:border-portal-danger focus-visible:ring-portal-danger/20'
      : 'border-border-light',
    props.disabled && 'cursor-not-allowed bg-smoke text-portal-muted opacity-70',
  ),
)
</script>

<template>
  <div class="block space-y-1.5" :data-invalid="error ? '' : undefined" :data-disabled="disabled ? '' : undefined">
    <label :for="fieldId" class="block text-sm font-medium text-title">{{ label }}</label>
    <textarea
      v-if="textarea"
      :id="fieldId"
      :name="name"
      :value="modelValue ?? ''"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="feedbackId"
      :class="[fieldClass, 'py-2.5']"
      @input="onInput"
    />
    <input
      v-else
      :id="fieldId"
      :name="name"
      :type="type"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :inputmode="inputmode"
      :autocomplete="autocomplete"
      :disabled="disabled"
      :required="required"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="feedbackId"
      :class="[fieldClass, 'min-h-[44px]']"
      @input="onInput"
    >
    <p v-if="error" :id="`${fieldId}-error`" class="text-xs text-portal-danger">{{ error }}</p>
    <p v-else-if="hint" :id="`${fieldId}-hint`" class="text-xs text-body">{{ hint }}</p>
  </div>
</template>
