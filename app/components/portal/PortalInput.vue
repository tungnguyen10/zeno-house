<script setup lang="ts">
import clsx from 'clsx'
import { useId } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string | null
  label: string
  type?: string
  revealable?: boolean
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
  revealable: false,
  textarea: false,
  rows: 4,
  disabled: false,
  required: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'blur', event: FocusEvent): void
}>()

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement | HTMLTextAreaElement).value)
}

function onBlur(event: FocusEvent) {
  emit('blur', event)
}

const generatedId = useId()
const fieldId = computed(() => props.id ?? `portal-input-${generatedId}`)
const feedbackId = computed(() => props.error
  ? `${fieldId.value}-error`
  : props.hint
    ? `${fieldId.value}-hint`
    : undefined)
const passwordVisible = ref(false)
const canRevealPassword = computed(() => (
  !props.textarea
  && props.revealable
  && props.type === 'password'
))
const resolvedType = computed(() => (
  canRevealPassword.value && passwordVisible.value ? 'text' : props.type
))

const fieldClass = computed(() =>
  clsx(
    'w-full rounded-xl border bg-white px-3.5 text-base sm:text-sm text-title transition-colors',
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
  <div
    class="block space-y-1.5"
    :data-invalid="error ? '' : undefined"
    :data-disabled="disabled ? '' : undefined"
  >
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
      @blur="onBlur"
    />
    <div v-else class="relative">
      <input
        :id="fieldId"
        :name="name"
        :type="resolvedType"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        :inputmode="inputmode"
        :autocomplete="autocomplete"
        :disabled="disabled"
        :required="required"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="feedbackId"
        :class="[fieldClass, 'min-h-[44px]', canRevealPassword ? 'pr-12' : undefined]"
        @input="onInput"
        @blur="onBlur"
      >
      <button
        v-if="canRevealPassword"
        type="button"
        class="absolute inset-y-0 right-0 flex size-11 items-center justify-center rounded-xl text-body transition-colors hover:text-title focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme/40 motion-reduce:transition-none"
        :aria-label="passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
        :aria-controls="fieldId"
        :aria-pressed="passwordVisible"
        :disabled="disabled"
        @click="passwordVisible = !passwordVisible"
      >
        <IconEyeOff v-if="passwordVisible" class="h-5 w-5" aria-hidden="true" />
        <IconEye v-else class="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
    <p
      :id="feedbackId"
      data-feedback
      :role="error ? 'alert' : undefined"
      :aria-hidden="!error && !hint ? 'true' : undefined"
      class="min-h-[1rem] text-xs"
      :class="error ? 'text-portal-danger' : 'text-body'"
    >
      {{ error || hint || '' }}
    </p>
  </div>
</template>
