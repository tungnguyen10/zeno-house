<script setup lang="ts">
import { computed, useAttrs, useId, useSlots, type InputHTMLAttributes, type StyleValue } from 'vue'
import clsx from 'clsx'

defineOptions({ inheritAttrs: false })

type UiInputType = 'text' | 'email' | 'password' | 'tel' | 'search' | 'url' | 'date' | 'number'
type UiInputMode = 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url' | 'search' | 'none'
type UiNumberMode = 'integer' | 'decimal' | 'currency' | 'meter' | 'area' | 'month' | 'year' | 'day' | 'percent'
type ModelModifiers = Partial<Record<'number' | 'trim', boolean>>

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  label?: string
  type?: UiInputType
  numberMode?: UiNumberMode
  inputmode?: UiInputMode
  placeholder?: string
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  id?: string
  inputClass?: string
  title?: string
  modelModifiers?: ModelModifiers
  /**
   * `normal` — default form field sizing (py-2).
   * `compact` — dense table-cell / matrix sizing (py-1 text-xs).
   */
  density?: 'normal' | 'compact'
}>(), {
  type: 'text',
  required: false,
  disabled: false,
  density: 'normal',
  modelModifiers: () => ({}),
})

const emit = defineEmits<{
  (e: 'update:modelValue' | 'change', value: string): void
  (e: 'blur', event: FocusEvent): void
}>()

// Stable id: prefer prop, else Vue's SSR-safe useId so the same instance keeps the same id
// across hydration. Avoids mismatched aria attributes on re-render.
const generatedId = useId()
const inputId = computed(() => props.id ?? generatedId)

const slots = useSlots()
const attrs = useAttrs()
const hasPrefix = computed(() => !!slots.prefix)
const hasSuffix = computed(() => !!slots.suffix)

const rootClass = computed(() => attrs.class)
const rootStyle = computed(() => attrs.style as StyleValue | undefined)

const nativeAttrs = computed(() => {
  const {
    class: _class,
    style: _style,
    inputmode: _inputmode,
    inputMode: _inputMode,
    autocomplete: _autocomplete,
    min: _min,
    max: _max,
    step: _step,
    ...rest
  } = attrs

  return rest
})

const rootDataAttrs = computed(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(([key]) => key.startsWith('data-')),
  ),
)

const defaultAutocomplete = computed(() => {
  switch (props.type) {
    case 'email': return 'email'
    case 'tel': return 'tel'
    default: return undefined
  }
})

const defaultInputmode = computed<UiInputMode | undefined>(() => {
  if (props.inputmode) return props.inputmode
  switch (props.type) {
    case 'email': return 'email'
    case 'tel': return 'tel'
    case 'search': return 'search'
    case 'url': return 'url'
    case 'number':
      return ['integer', 'month', 'year', 'day'].includes(props.numberMode ?? '')
        ? 'numeric'
        : 'decimal'
    default:
      return undefined
  }
})

const defaultStep = computed(() => {
  if (props.type !== 'number') return undefined
  switch (props.numberMode) {
    case 'integer':
    case 'month':
    case 'year':
    case 'day':
    case 'currency':
      return '1'
    case 'decimal':
      return 'any'
    case 'meter':
    case 'area':
    case 'percent':
      return '0.01'
    default:
      return undefined
  }
})

const defaultMin = computed(() => {
  if (props.type !== 'number') return undefined
  return props.numberMode === 'month' ? '1' : undefined
})

const defaultMax = computed(() => {
  if (props.type !== 'number') return undefined
  return props.numberMode === 'month' ? '12' : undefined
})

function attrString(name: string) {
  const value = attrs[name]
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return undefined
}

const effectiveInputmode = computed(() =>
  (attrString('inputmode') ?? attrString('inputMode') ?? defaultInputmode.value) as UiInputMode | undefined,
)

const effectiveAutocomplete = computed<InputHTMLAttributes['autocomplete']>(() =>
  (attrString('autocomplete') ?? defaultAutocomplete.value) as InputHTMLAttributes['autocomplete'],
)

function normalizedValue(event: Event): string | number {
  const target = event.target as HTMLInputElement
  let value = target.value
  if (props.modelModifiers.trim) value = value.trim()
  if (!props.modelModifiers.number) return value

  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? value : parsed
}

function emitInput(event: Event) {
  emit('update:modelValue', normalizedValue(event) as string)
}

function emitChange(event: Event) {
  emit('change', normalizedValue(event) as string)
}

const wrapperClass = computed(() =>
  clsx(
    'flex w-full items-stretch rounded-md border bg-dark-surface text-white',
    'focus-within:ring-2 focus-within:ring-offset-0',
    props.error
      ? 'border-error/50 focus-within:border-error/60 focus-within:ring-error/30'
      : 'border-dark-border focus-within:border-cyan/70 focus-within:ring-cyan/30',
    props.disabled && 'bg-dark-hover text-muted cursor-not-allowed',
  ),
)

const inputClass = computed(() =>
  clsx(
    'block w-full bg-transparent px-3 text-white placeholder-muted',
    'focus:outline-none',
    props.density === 'compact' ? 'py-1 text-xs' : 'py-2 text-sm',
    hasPrefix.value && 'pl-1',
    hasSuffix.value && 'pr-1',
    props.disabled && 'cursor-not-allowed text-muted',
    props.inputClass,
  ),
)
</script>

<template>
  <div
    v-bind="rootDataAttrs"
    :class="['ui-field flex flex-col gap-1.5', rootClass]"
    :style="rootStyle"
    :data-invalid="error ? '' : undefined"
    :data-disabled="disabled ? '' : undefined"
  >
    <label
      v-if="label"
      :for="inputId"
      class="text-sm font-medium text-muted"
    >
      {{ label }}
      <span v-if="required" class="text-error ml-0.5" aria-hidden="true">*</span>
    </label>

    <div :class="wrapperClass">
      <span
        v-if="hasPrefix"
        class="flex items-center pl-3 pr-1 text-sm text-muted select-none whitespace-nowrap"
        aria-hidden="true"
      >
        <slot name="prefix" />
      </span>

      <input
        v-bind="nativeAttrs"
        :id="inputId"
        :type="type"
        :inputmode="effectiveInputmode"
        :autocomplete="effectiveAutocomplete"
        :min="attrString('min') ?? defaultMin"
        :max="attrString('max') ?? defaultMax"
        :step="attrString('step') ?? defaultStep"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :title="title"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined"
        :class="inputClass"
        @input="emitInput"
        @change="emitChange"
        @blur="emit('blur', $event)"
      >

      <span
        v-if="hasSuffix"
        class="flex items-center pr-3 pl-1 text-sm text-muted select-none whitespace-nowrap"
        aria-hidden="true"
      >
        <slot name="suffix" />
      </span>
    </div>

    <p v-if="error" :id="`${inputId}-error`" class="text-xs text-error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${inputId}-hint`" class="text-xs text-muted">
      {{ hint }}
    </p>
  </div>
</template>
