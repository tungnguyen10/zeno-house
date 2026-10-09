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
  /** Options are supplied by a server-backed search instead of filtered locally. */
  remoteSearch?: boolean
  /** Allow selecting the current search query as a new option. */
  allowCustom?: boolean
  /** Convert a custom query into the option value emitted by v-model. */
  createOption?: (query: string) => TOption
  /** Label prefix for the custom option row. */
  customOptionLabel?: string
  /** Message shown when no options match the search query. */
  emptyMessage?: string
  id?: string
}

const props = withDefaults(defineProps<UiComboboxProps<TOption>>(), {
  modelValue: null,
  required: false,
  disabled: false,
  loading: false,
  remoteSearch: false,
  allowCustom: false,
  emptyMessage: 'Không có kết quả',
  placeholder: 'Chọn...',
  searchPlaceholder: 'Tìm kiếm...',
  customOptionLabel: 'Dùng',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: TOption | null): void
  (e: 'search', query: string): void
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
  if (props.remoteSearch) return props.options
  if (!query.value) return props.options
  const q = query.value.toLowerCase()
  return props.options.filter(o =>
    props.optionLabel(o).toLowerCase().includes(q),
  )
})

watch(query, value => {
  if (isOpen.value && props.remoteSearch) emit('search', value)
})

const trimmedQuery = computed(() => query.value.trim())

const customOption = computed<TOption | null>(() => {
  if (!props.allowCustom || !props.createOption || !trimmedQuery.value) return null
  const q = trimmedQuery.value.toLowerCase()
  const exact = props.options.some(o => props.optionLabel(o).toLowerCase() === q)
  return exact ? null : props.createOption(trimmedQuery.value)
})

const optionCount = computed(() =>
  filteredOptions.value.length + (customOption.value ? 1 : 0),
)

// ── Helpers ────────────────────────────────────────────────────────────────
function openDropdown() {
  if (props.disabled || props.loading) return
  isOpen.value = true
  query.value = selectedLabel.value
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

function selectCustom() {
  if (!customOption.value) return
  select(customOption.value)
}

function clear() {
  emit('update:modelValue', null)
  closeDropdown()
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
    activeIndex.value = Math.min(activeIndex.value + 1, optionCount.value - 1)
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
    else if (activeIndex.value === opts.length && customOption.value) {
      selectCustom()
    }
    else if (customOption.value) {
      selectCustom()
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
    'flex w-full items-center justify-between rounded-md border bg-ui-surface px-3 py-2 text-base sm:text-sm',
    'min-h-11 sm:min-h-10',
    'transition-colors cursor-pointer select-none',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    props.error
      ? 'border-status-danger/50 focus:border-status-danger/60 focus:ring-status-danger/30'
      : 'border-ui-border-strong focus:border-ui-accent/70 focus:ring-ui-accent/30',
    props.disabled || props.loading
      ? 'opacity-50 cursor-not-allowed pointer-events-none bg-ui-hover'
      : 'hover:border-ui-border/80',
  ),
)

const triggerLabelClass = computed(() =>
  clsx(
    'min-w-0 truncate',
    props.modelValue ? 'text-ui-primary' : 'text-ui-muted',
    props.modelValue && !props.disabled && !props.loading && 'pr-7',
  ),
)
</script>

<template>
  <div
    ref="containerRef"
    class="flex flex-col gap-1.5 min-w-0"
    :data-invalid="error ? '' : undefined"
    :data-disabled="disabled ? '' : undefined"
  >
    <!-- Label -->
    <label
      v-if="label"
      :for="comboboxId"
      class="text-sm font-medium text-ui-muted"
    >
      {{ label }}
      <span v-if="required" class="text-status-danger ml-0.5" aria-hidden="true">*</span>
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
        <span :class="triggerLabelClass">
          {{ modelValue ? selectedLabel : placeholder }}
        </span>

        <span class="flex items-center gap-1 shrink-0 ml-2">
          <IconSpinner
            v-if="loading"
            class="size-4 animate-spin text-ui-muted"
            aria-hidden="true"
          />

          <!-- Chevron -->
          <IconChevronDown
            v-else
            class="size-4 text-ui-muted transition-transform"
            :class="isOpen ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </span>
      </button>

      <!-- Clear button (kept outside the combobox trigger to avoid nested buttons) -->
      <button
        v-if="modelValue && !disabled && !loading"
        type="button"
        class="absolute right-8 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-ui-muted transition-colors hover:bg-ui-hover hover:text-ui-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/30"
        aria-label="Xóa lựa chọn"
        @click.stop.prevent="clear"
      >
        <IconX class="size-3.5" aria-hidden="true" />
      </button>

      <!-- Dropdown panel -->
      <div
        v-if="isOpen"
        class="absolute z-50 mt-1 w-full rounded-md border border-ui-border bg-ui-chrome shadow-lg"
      >
        <!-- Search input -->
        <div class="p-2 border-b border-ui-border">
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            :placeholder="searchPlaceholder"
            class="w-full rounded bg-ui-surface border border-ui-border-strong px-2 py-1.5 text-base sm:text-sm text-ui-primary placeholder-ui-muted focus:outline-none focus:border-ui-accent/70 focus:ring-1 focus:ring-ui-accent/30"
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
          <li v-if="loading" class="px-3 py-2 text-sm text-ui-muted">
            Đang tải...
          </li>

          <!-- Empty state -->
          <li
            v-else-if="filteredOptions.length === 0 && !customOption"
            class="px-3 py-2 text-sm text-ui-muted text-center"
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
              index === activeIndex ? 'bg-ui-accent/15 text-ui-primary' : 'text-ui-primary hover:bg-ui-hover',
              isSelected(option) && 'text-ui-accent',
            )"
            @mousedown.prevent="select(option)"
            @mouseover="activeIndex = index"
          >
            <span>{{ optionLabel(option) }}</span>
            <!-- Checkmark for selected -->
          <IconCheckSmall
            v-if="isSelected(option)"
            class="size-4 shrink-0 text-ui-accent"
            aria-hidden="true"
          />
          </li>

          <!-- Custom typed option -->
          <li
            v-if="customOption"
            role="option"
            :aria-selected="activeIndex === filteredOptions.length"
            :class="clsx(
              'flex items-center justify-between gap-3 border-t border-ui-border px-3 py-2 text-sm cursor-pointer transition-colors',
              activeIndex === filteredOptions.length ? 'bg-ui-accent/15 text-ui-primary' : 'text-ui-primary hover:bg-ui-hover',
            )"
            @mousedown.prevent="selectCustom"
            @mouseover="activeIndex = filteredOptions.length"
          >
            <span class="min-w-0 truncate">
              <span class="text-ui-muted">{{ customOptionLabel }}</span>
              <span class="ml-1 text-ui-primary">"{{ trimmedQuery }}"</span>
            </span>
            <IconPlus class="size-4 shrink-0 text-ui-accent" aria-hidden="true" />
          </li>
        </ul>
      </div>
    </div>

    <!-- Error / hint -->
    <p v-if="error" :id="`${comboboxId}-error`" class="text-xs text-status-danger" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${comboboxId}-hint`" class="text-xs text-ui-muted">
      {{ hint }}
    </p>
  </div>
</template>
