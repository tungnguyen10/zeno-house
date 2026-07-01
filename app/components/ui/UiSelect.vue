<script setup lang="ts">
import { useSlots } from 'vue'
import clsx from 'clsx'

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
const slots = useSlots()
const hasPrefix = computed(() => !!slots.prefix)

// ── State ──────────────────────────────────────────────────────────────────
const isOpen = ref(false)
const activeIndex = ref(-1)
const containerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const listboxRef = ref<HTMLUListElement | null>(null)

// ── Derived ────────────────────────────────────────────────────────────────
const selectedOption = computed(() =>
  props.modelValue === null || props.modelValue === undefined
    ? null
    : props.options.find(o => o.value === props.modelValue) ?? null,
)

const displayLabel = computed(() => selectedOption.value?.label ?? '')

// ── Helpers ────────────────────────────────────────────────────────────────
function openDropdown() {
  if (props.disabled) return
  isOpen.value = true
  const selectedIndex = props.options.findIndex(o => o.value === props.modelValue)
  activeIndex.value = selectedIndex >= 0 ? selectedIndex : firstEnabledIndex()
  nextTick(scrollActiveIntoView)
}

function closeDropdown() {
  isOpen.value = false
  activeIndex.value = -1
}

function toggleDropdown() {
  if (isOpen.value) closeDropdown()
  else openDropdown()
}

function select(option: SelectOption) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  closeDropdown()
  triggerRef.value?.focus()
}

function firstEnabledIndex() {
  return props.options.findIndex(o => !o.disabled)
}

function scrollActiveIntoView() {
  const list = listboxRef.value
  if (!list || activeIndex.value < 0) return
  const item = list.children[activeIndex.value] as HTMLElement | undefined
  item?.scrollIntoView({ block: 'nearest' })
}

function moveActive(step: 1 | -1) {
  const count = props.options.length
  if (count === 0) return
  let next = activeIndex.value
  for (let i = 0; i < count; i++) {
    next = (next + step + count) % count
    if (!props.options[next]?.disabled) {
      activeIndex.value = next
      nextTick(scrollActiveIntoView)
      return
    }
  }
}

function isSelected(option: SelectOption) {
  return props.modelValue === option.value
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
      if (activeIndex.value >= 0 && props.options[activeIndex.value]) {
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
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => document.addEventListener('mousedown', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentClick))

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
  <div ref="containerRef" class="flex flex-col gap-1.5">
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
        class="pointer-events-none absolute left-3 top-1/2 z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-muted"
        aria-hidden="true"
      >
        <slot name="prefix" />
      </span>

      <button
        :id="selectId"
        ref="triggerRef"
        type="button"
        role="combobox"
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
        class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-transform"
        :class="isOpen ? 'rotate-180' : ''"
        aria-hidden="true"
      />

      <ul
        v-if="isOpen"
        :id="`${selectId}-listbox`"
        ref="listboxRef"
        role="listbox"
        :aria-label="label"
        class="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-dark-border bg-dark-card py-1 shadow-lg"
      >
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
            class="ml-2 h-3 w-3 shrink-0 text-cyan"
            aria-hidden="true"
          />
        </li>
      </ul>
    </div>

    <p v-if="error" :id="`${selectId}-error`" class="text-xs text-error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${selectId}-hint`" class="text-xs text-muted">
      {{ hint }}
    </p>
  </div>
</template>
