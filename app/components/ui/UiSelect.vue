<script setup lang="ts">
import { useAttrs, useSlots } from 'vue'
import clsx from 'clsx'

defineOptions({ inheritAttrs: false })

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  label?: string
  options: SelectOption[]
  placeholder?: string
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  id?: string
  /**
   * `normal` — default form field sizing (py-2).
   * `compact` — dense table-cell / matrix sizing (py-1 text-xs).
   */
  density?: 'normal' | 'compact'
}>(), {
  modelValue: null,
  required: false,
  disabled: false,
  density: 'normal',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | null): void
  (e: 'blur', event: FocusEvent): void
}>()

const generatedId = useId()
const selectId = computed(() => props.id ?? generatedId)
const attrs = useAttrs()
const slots = useSlots()
const hasPrefix = computed(() => !!slots.prefix)
const rootClass = computed(() => attrs.class)
const rootStyle = computed(() => attrs.style)
const triggerAriaLabel = computed(() => {
  const value = attrs['aria-label']
  return typeof value === 'string' ? value : undefined
})
const triggerAttrs = computed(() => {
  const {
    class: _class,
    style: _style,
    'aria-label': _ariaLabel,
    ...rest
  } = attrs
  return rest
})

// ── State ──────────────────────────────────────────────────────────────────
const isOpen = ref(false)
const activeIndex = ref(-1)
const containerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const listboxRef = ref<HTMLUListElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

// ── Derived ────────────────────────────────────────────────────────────────
const selectedOption = computed(() =>
  props.options.find(o => optionMatchesValue(o, props.modelValue)) ?? null,
)

const displayLabel = computed(() => selectedOption.value?.label ?? '')
const hasEmptyValueOption = computed(() => props.options.some(o => o.value === ''))
const hasPlaceholderOption = computed(() => !!props.placeholder && !hasEmptyValueOption.value)
const canSelectPlaceholder = computed(() => hasPlaceholderOption.value && !props.required)
const isPlaceholderSelected = computed(() =>
  selectedOption.value === null
  && (props.modelValue === null || props.modelValue === undefined || props.modelValue === ''),
)

// ── Helpers ────────────────────────────────────────────────────────────────
function optionMatchesValue(option: SelectOption, value: string | number | null | undefined) {
  if (value === null || value === undefined) return option.value === ''
  return option.value === value || String(option.value) === String(value)
}

function enabledPositions() {
  const positions = props.options
    .map((option, index) => option.disabled ? null : index)
    .filter((index): index is number => index !== null)
  return canSelectPlaceholder.value ? [-1, ...positions] : positions
}

function openDropdown() {
  if (props.disabled) return
  isOpen.value = true
  const selectedIndex = props.options.findIndex(o => optionMatchesValue(o, props.modelValue))
  activeIndex.value = selectedIndex >= 0
    ? selectedIndex
    : isPlaceholderSelected.value && canSelectPlaceholder.value
      ? -1
      : firstEnabledIndex()
  nextTick(() => {
    updateDropdownPosition()
    scrollActiveIntoView()
  })
}

function closeDropdown() {
  isOpen.value = false
  activeIndex.value = -1
}

function toggleDropdown() {
  if (isOpen.value) closeDropdown()
  else openDropdown()
}

function updateDropdownPosition() {
  const trigger = triggerRef.value
  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const maxHeight = Math.max(100, Math.min(240, spaceBelow))

  dropdownStyle.value = {
    left: `${rect.left}px`,
    top: `${rect.bottom + 4}px`,
    width: `${rect.width}px`,
    maxHeight: `${maxHeight}px`,
  }
}

function select(option: SelectOption) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  closeDropdown()
  triggerRef.value?.focus()
}

function selectPlaceholder() {
  if (!canSelectPlaceholder.value) return
  emit('update:modelValue', null)
  closeDropdown()
  triggerRef.value?.focus()
}

function firstEnabledIndex() {
  return enabledPositions()[0] ?? -1
}

function scrollActiveIntoView() {
  const list = listboxRef.value
  if (!list) return
  if (activeIndex.value === -1 && !hasPlaceholderOption.value) return
  const childIndex = activeIndex.value === -1
    ? 0
    : activeIndex.value + (hasPlaceholderOption.value ? 1 : 0)
  const item = list.children[childIndex] as HTMLElement | undefined
  item?.scrollIntoView({ block: 'nearest' })
}

function moveActive(step: 1 | -1) {
  const positions = enabledPositions()
  if (positions.length === 0) return
  const currentPosition = positions.indexOf(activeIndex.value)
  const basePosition = currentPosition >= 0 ? currentPosition : step === 1 ? -1 : 0
  const nextPosition = (basePosition + step + positions.length) % positions.length
  activeIndex.value = positions[nextPosition]!
  nextTick(scrollActiveIntoView)
}

function isSelected(option: SelectOption) {
  return optionMatchesValue(option, props.modelValue)
}

// ── Keyboard ───────────────────────────────────────────────────────────────
function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return

  if (!isOpen.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openDropdown()
    }
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      moveActive(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      moveActive(-1)
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (activeIndex.value === -1) {
        selectPlaceholder()
      }
      else if (props.options[activeIndex.value]) {
        select(props.options[activeIndex.value]!)
      }
      break
    case 'Escape':
      event.preventDefault()
      closeDropdown()
      break
    case 'Tab':
      closeDropdown()
      break
  }
}

// ── Click-outside ──────────────────────────────────────────────────────────
function onDocumentClick(event: MouseEvent) {
  const target = event.target as Node
  if (containerRef.value?.contains(target)) return
  if (listboxRef.value?.contains(target)) return
  if (isOpen.value) {
    closeDropdown()
  }
}

onMounted(() => document.addEventListener('mousedown', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentClick))

watch(isOpen, (open) => {
  if (open) {
    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)
    nextTick(updateDropdownPosition)
    return
  }

  window.removeEventListener('resize', updateDropdownPosition)
  window.removeEventListener('scroll', updateDropdownPosition, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateDropdownPosition)
  window.removeEventListener('scroll', updateDropdownPosition, true)
})

// ── Styles ─────────────────────────────────────────────────────────────────
const triggerClass = computed(() =>
  clsx(
    'flex w-full items-center justify-between rounded-md border bg-dark-surface pr-9 text-left text-white',
    'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0',
    props.density === 'compact' ? 'py-1 text-xs' : 'py-2 text-sm',
    hasPrefix.value ? 'pl-9' : 'pl-3',
    props.error
      ? 'border-error/50 focus:border-error/60 focus:ring-error/30'
      : 'border-dark-border focus:border-cyan/70 focus:ring-cyan/30',
    props.disabled
      ? 'bg-dark-hover text-muted cursor-not-allowed'
      : 'cursor-pointer hover:border-dark-border/80',
  ),
)
</script>

<template>
  <div
    ref="containerRef"
    :class="['ui-field flex flex-col gap-1.5', rootClass]"
    :style="rootStyle"
    :data-invalid="error ? '' : undefined"
    :data-disabled="disabled ? '' : undefined"
  >
    <label
      v-if="label"
      :for="selectId"
      class="text-sm font-medium text-muted"
    >
      {{ label }}
      <span v-if="required" class="text-error ml-0.5" aria-hidden="true">*</span>
    </label>

    <div class="relative">
      <span
        v-if="hasPrefix"
        class="pointer-events-none absolute left-3 top-1/2 z-10 flex size-4 -translate-y-1/2 items-center justify-center text-muted"
        aria-hidden="true"
      >
        <slot name="prefix" />
      </span>

      <button
        v-bind="triggerAttrs"
        :id="selectId"
        ref="triggerRef"
        type="button"
        role="combobox"
        :aria-label="triggerAriaLabel"
        :aria-expanded="isOpen"
        aria-haspopup="listbox"
        :aria-controls="`${selectId}-listbox`"
        :aria-invalid="!!error"
        :aria-required="required"
        :aria-describedby="error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined"
        :disabled="disabled"
        :class="triggerClass"
        @click="toggleDropdown"
        @keydown="onKeydown"
        @blur="emit('blur', $event)"
      >
        <span :class="selectedOption ? 'text-white' : 'text-muted'" class="truncate">
          {{ selectedOption ? displayLabel : (placeholder ?? '') }}
        </span>
      </button>

      <IconChevronDown
        class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted transition-transform"
        :class="isOpen ? 'rotate-180' : ''"
        aria-hidden="true"
      />

      <Teleport to="body">
        <ul
          v-if="isOpen"
          :id="`${selectId}-listbox`"
          ref="listboxRef"
          role="listbox"
          :aria-label="label ?? triggerAriaLabel"
          :style="dropdownStyle"
          class="fixed z-[70] overflow-y-auto rounded-md border border-dark-border bg-dark-card py-1 shadow-lg"
        >
          <li
            v-if="hasPlaceholderOption"
            role="option"
            :aria-selected="isPlaceholderSelected"
            :aria-disabled="required"
            :class="clsx(
              'flex items-center justify-between px-3 text-sm transition-colors',
              density === 'compact' ? 'py-1.5 text-xs' : 'py-2',
              required
                ? 'cursor-not-allowed text-muted/60'
                : 'cursor-pointer text-muted',
              !required && activeIndex === -1 && 'bg-cyan/15',
              !required && activeIndex !== -1 && 'hover:bg-dark-hover',
              isPlaceholderSelected && !required && 'text-cyan',
            )"
            @mousedown.prevent="selectPlaceholder"
            @mouseover="!required && (activeIndex = -1)"
          >
            <span class="truncate">{{ placeholder }}</span>
            <IconCheckSmall
              v-if="isPlaceholderSelected"
              class="ml-2 size-3 shrink-0 text-cyan"
              aria-hidden="true"
            />
          </li>
          <li
            v-for="(option, index) in options"
            :key="option.value"
            role="option"
            :aria-selected="isSelected(option)"
            :aria-disabled="option.disabled"
            :class="clsx(
              'flex items-center justify-between px-3 text-sm transition-colors',
              density === 'compact' ? 'py-1.5 text-xs' : 'py-2',
              option.disabled
                ? 'cursor-not-allowed text-muted/60'
                : 'cursor-pointer text-white',
              !option.disabled && index === activeIndex && 'bg-cyan/15',
              !option.disabled && index !== activeIndex && 'hover:bg-dark-hover',
              isSelected(option) && !option.disabled && 'text-cyan',
            )"
            @mousedown.prevent="select(option)"
            @mouseover="!option.disabled && (activeIndex = index)"
          >
            <span class="truncate">{{ option.label }}</span>
            <IconCheckSmall
              v-if="isSelected(option)"
              class="ml-2 size-3 shrink-0 text-cyan"
              aria-hidden="true"
            />
          </li>
        </ul>
      </Teleport>
    </div>

    <p v-if="error" :id="`${selectId}-error`" class="text-xs text-error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${selectId}-hint`" class="text-xs text-muted">
      {{ hint }}
    </p>
  </div>
</template>
