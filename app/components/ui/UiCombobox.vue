<script setup lang="ts" generic="TOption">
/**
 * UiCombobox — searchable selection primitive.
 *
 * Name choice: `UiCombobox` over `UiSearchSelect` because the component
 * follows the ARIA combobox pattern (text input + popup listbox) and is
 * intentionally domain-agnostic — it receives option identity/label via
 * props without room/tenant-specific assumptions.
 */
import clsx from 'clsx'

export interface UiComboboxProps<TOption> {
  modelValue?: TOption | null
  options: TOption[]
  /** Extract a stable unique key from an option. Used for v-key and identity. */
  optionKey: (option: TOption) => string | number
  /** Extract the display label from an option. Used in list and selected display. */
  optionLabel: (option: TOption) => string
  label?: string
  placeholder?: string
  searchPlaceholder?: string
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  loading?: boolean
  /** Message shown when no options match the search query. */
  emptyMessage?: string
  id?: string
}

const props = withDefaults(defineProps<UiComboboxProps<TOption>>(), {
  modelValue: null,
  required: false,
  disabled: false,
  loading: false,
  emptyMessage: 'Không có kết quả',
  placeholder: 'Chọn...',
  searchPlaceholder: 'Tìm kiếm...',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: TOption | null): void
}>()

const generatedId = useId()
const comboboxId = computed(() => props.id ?? generatedId)

// ── State ──────────────────────────────────────────────────────────────────
const isOpen = ref(false)
const query = ref('')
const listboxRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const activeIndex = ref(-1)

// ── Derived ────────────────────────────────────────────────────────────────
const selectedLabel = computed(() =>
  props.modelValue ? props.optionLabel(props.modelValue) : '',
)

const filteredOptions = computed(() => {
  if (!query.value) return props.options
  const q = query.value.toLowerCase()
  return props.options.filter(o =>
    props.optionLabel(o).toLowerCase().includes(q),
  )
})

// ── Helpers ────────────────────────────────────────────────────────────────
function openDropdown() {
  if (props.disabled || props.loading) return
  isOpen.value = true
  query.value = ''
  activeIndex.value = -1
  nextTick(() => inputRef.value?.focus())
}

function closeDropdown() {
  isOpen.value = false
  query.value = ''
  activeIndex.value = -1
}

function select(option: TOption) {
  emit('update:modelValue', option)
  closeDropdown()
}

function clear() {
  emit('update:modelValue', null)
}

function isSelected(option: TOption) {
  if (!props.modelValue) return false
  return props.optionKey(option) === props.optionKey(props.modelValue)
}

// ── Keyboard navigation ────────────────────────────────────────────────────
function onKeydown(event: KeyboardEvent) {
  const opts = filteredOptions.value
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, opts.length - 1)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    if (activeIndex.value >= 0 && opts[activeIndex.value]) {
      select(opts[activeIndex.value]!)
    }
  }
  else if (event.key === 'Escape' || event.key === 'Tab') {
    closeDropdown()
  }
}

// ── Click-outside ──────────────────────────────────────────────────────────
const containerRef = ref<HTMLElement | null>(null)

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
    'flex w-full items-center justify-between rounded-md border bg-dark-surface px-3 py-2 text-sm',
    'transition-colors cursor-pointer select-none',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    props.error
      ? 'border-error/50 focus:border-error/60 focus:ring-error/30'
      : 'border-dark-border focus:border-cyan/70 focus:ring-cyan/30',
    props.disabled || props.loading
      ? 'opacity-50 cursor-not-allowed pointer-events-none bg-dark-hover'
      : 'hover:border-dark-border/80',
  ),
)
</script>

<template>
  <div ref="containerRef" class="flex flex-col gap-1.5">
    <!-- Label -->
    <label
      v-if="label"
      :for="comboboxId"
      class="text-sm font-medium text-muted"
    >
      {{ label }}
      <span v-if="required" class="text-error ml-0.5" aria-hidden="true">*</span>
    </label>

    <!-- Trigger button (shows selected value or placeholder) -->
    <div class="relative">
      <button
        :id="comboboxId"
        type="button"
        role="combobox"
        :aria-expanded="isOpen"
        :aria-haspopup="'listbox'"
        :aria-controls="`${comboboxId}-listbox`"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${comboboxId}-error` : hint ? `${comboboxId}-hint` : undefined"
        :aria-required="required"
        :disabled="disabled || loading"
        :class="triggerClass"
        @click="openDropdown"
      >
        <!-- Selected value / placeholder -->
        <span :class="modelValue ? 'text-white' : 'text-muted'">
          {{ modelValue ? selectedLabel : placeholder }}
        </span>

        <span class="flex items-center gap-1 shrink-0 ml-2">
          <IconSpinner
            v-if="loading"
            class="animate-spin h-4 w-4 text-muted"
            aria-hidden="true"
          />

          <!-- Clear button (only when a value is selected and not disabled/loading) -->
          <button
            v-else-if="modelValue && !disabled"
            type="button"
            class="rounded p-0.5 text-muted hover:text-white hover:bg-dark-hover transition-colors"
            :aria-label="`Xóa lựa chọn`"
            tabindex="-1"
            @click.stop="clear"
          >
            <IconX class="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <!-- Chevron -->
          <IconChevronDown
            v-else
            class="h-4 w-4 text-muted transition-transform"
            :class="isOpen ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </span>
      </button>

      <!-- Dropdown panel -->
      <div
        v-if="isOpen"
        class="absolute z-50 mt-1 w-full rounded-md border border-dark-border bg-dark-card shadow-lg"
      >
        <!-- Search input -->
        <div class="p-2 border-b border-dark-border">
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            :placeholder="searchPlaceholder"
            class="w-full rounded bg-dark-surface border border-dark-border px-2 py-1.5 text-sm text-white placeholder-muted focus:outline-none focus:border-cyan/70 focus:ring-1 focus:ring-cyan/30"
            autocomplete="off"
            @keydown="onKeydown"
          >
        </div>

        <!-- Options list -->
        <ul
          :id="`${comboboxId}-listbox`"
          ref="listboxRef"
          role="listbox"
          :aria-label="label"
          class="max-h-56 overflow-y-auto py-1"
        >
          <!-- Loading state -->
          <li v-if="loading" class="px-3 py-2 text-sm text-muted">
            Đang tải...
          </li>

          <!-- Empty state -->
          <li
            v-else-if="filteredOptions.length === 0"
            class="px-3 py-2 text-sm text-muted text-center"
          >
            {{ emptyMessage }}
          </li>

          <!-- Option items -->
          <li
            v-for="(option, index) in filteredOptions"
            :key="optionKey(option)"
            role="option"
            :aria-selected="isSelected(option)"
            :class="clsx(
              'flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors',
              index === activeIndex ? 'bg-cyan/15 text-white' : 'text-white hover:bg-dark-hover',
              isSelected(option) && 'text-cyan',
            )"
            @mousedown.prevent="select(option)"
            @mouseover="activeIndex = index"
          >
            <span>{{ optionLabel(option) }}</span>
            <!-- Checkmark for selected -->
            <IconCheckSmall
              v-if="isSelected(option)"
              class="h-4 w-4 text-cyan shrink-0"
              aria-hidden="true"
            />
          </li>
        </ul>
      </div>
    </div>

    <!-- Error / hint -->
    <p v-if="error" :id="`${comboboxId}-error`" class="text-xs text-error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${comboboxId}-hint`" class="text-xs text-muted">
      {{ hint }}
    </p>
  </div>
</template>
