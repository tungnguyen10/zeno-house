<script setup lang="ts">
import { computed, nextTick, ref, useAttrs, useId, type StyleValue } from 'vue'
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import dayjs from 'dayjs'
import clsx from 'clsx'

defineOptions({ inheritAttrs: false })

type DateMode = 'iso' | 'past' | 'future' | 'period-start' | 'period-end' | 'payment' | 'reading' | 'operational'
type PickerMode = 'date' | 'month'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  label?: string
  placeholder?: string
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  id?: string
  triggerClass?: string
  density?: 'normal' | 'compact'
  dateMode?: DateMode
  pickerMode?: PickerMode
  minDate?: string
  maxDate?: string
  clearable?: boolean
}>(), {
  placeholder: 'Chọn ngày',
  required: false,
  disabled: false,
  density: 'normal',
  dateMode: 'iso',
  pickerMode: 'date',
  clearable: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue' | 'change', value: string): void
  (e: 'blur', event: FocusEvent): void
}>()

const attrs = useAttrs()
const generatedId = useId()
const pickerId = computed(() => props.id ?? generatedId)
const panelId = computed(() => `${pickerId.value}-panel`)
const todayIso = dayjs().format('YYYY-MM-DD')

const rootClass = computed(() => attrs.class)
const rootStyle = computed(() => attrs.style as StyleValue | undefined)
const rootDataAttrs = computed(() =>
  Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-'))),
)

const triggerAttrs = computed(() => {
  const {
    class: _class,
    style: _style,
    min: _min,
    max: _max,
    ...rest
  } = attrs

  return rest
})

function attrString(name: string) {
  const value = attrs[name]
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return undefined
}

function isIsoDate(value: string | null | undefined) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && dayjs(value).isValid()
}

function isMonthPeriod(value: string | null | undefined) {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

const isMonthMode = computed(() => props.pickerMode === 'month')

const selectedDate = computed(() => {
  if (isMonthMode.value) {
    if (!isMonthPeriod(props.modelValue)) return null
    return dayjs(`${props.modelValue}-01`)
  }
  return isIsoDate(props.modelValue) ? dayjs(props.modelValue) : null
})
const selectedValue = computed(() =>
  isMonthMode.value
    ? selectedDate.value?.format('YYYY-MM') ?? ''
    : selectedDate.value?.format('YYYY-MM-DD') ?? '',
)
const displayValue = computed(() =>
  isMonthMode.value
    ? selectedDate.value?.format('MM/YYYY') ?? ''
    : selectedDate.value?.format('DD/MM/YYYY') ?? '',
)

const effectiveMinDate = computed(() => {
  const explicit = props.minDate ?? attrString('min')
  if (explicit) return explicit
  return props.dateMode === 'future' ? todayIso : undefined
})

const effectiveMaxDate = computed(() => {
  const explicit = props.maxDate ?? attrString('max')
  if (explicit) return explicit
  return props.dateMode === 'past' ? todayIso : undefined
})

const minPeriod = computed(() => {
  const value = effectiveMinDate.value
  if (!value) return undefined
  if (isMonthPeriod(value)) return value
  return isIsoDate(value) ? value.slice(0, 7) : undefined
})

const maxPeriod = computed(() => {
  const value = effectiveMaxDate.value
  if (!value) return undefined
  if (isMonthPeriod(value)) return value
  return isIsoDate(value) ? value.slice(0, 7) : undefined
})

const isOpen = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const visibleMonth = ref((selectedDate.value ?? dayjs()).startOf('month'))
const visibleYear = ref((selectedDate.value ?? dayjs()).year())
const focusedIso = ref(selectedValue.value || todayIso)
const focusedPeriod = ref(selectedValue.value || dayjs().format('YYYY-MM'))

const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const monthLabel = computed(() => {
  if (isMonthMode.value) return `Năm ${visibleYear.value}`
  const month = visibleMonth.value.month() + 1
  return `Tháng ${month}/${visibleMonth.value.year()}`
})

const triggerClass = computed(() =>
  clsx(
    'flex w-full items-center justify-between gap-2 rounded-md border bg-dark-surface text-left text-white transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
    props.error
      ? 'border-error/50 focus-visible:border-error/60 focus-visible:ring-error/30'
      : 'border-dark-border hover:border-cyan/50 focus-visible:border-cyan/70 focus-visible:ring-cyan/30',
    props.density === 'compact' ? 'min-h-7 px-2 py-1 text-xs' : 'min-h-10 px-3 py-2 text-sm',
    props.disabled && 'cursor-not-allowed bg-dark-hover text-muted opacity-70',
    props.triggerClass,
  ),
)

const calendarDays = computed(() => {
  if (isMonthMode.value) return []
  const start = visibleMonth.value.startOf('month')
  const offset = (start.day() + 6) % 7
  const firstCell = start.subtract(offset, 'day')

  return Array.from({ length: 42 }, (_, index) => {
    const date = firstCell.add(index, 'day')
    const iso = date.format('YYYY-MM-DD')
    const min = effectiveMinDate.value
    const max = effectiveMaxDate.value

    return {
      iso,
      day: date.date(),
      inMonth: date.month() === visibleMonth.value.month(),
      isToday: iso === todayIso,
      isSelected: iso === selectedValue.value,
      isFocused: iso === focusedIso.value,
      disabled: (!!min && iso < min) || (!!max && iso > max),
    }
  })
})

const monthCells = computed(() => {
  if (!isMonthMode.value) return []

  return Array.from({ length: 12 }, (_, index) => {
    const period = `${visibleYear.value}-${String(index + 1).padStart(2, '0')}`
    const min = minPeriod.value
    const max = maxPeriod.value

    return {
      value: period,
      label: `Tháng ${index + 1}`,
      isSelected: period === selectedValue.value,
      isFocused: period === focusedPeriod.value,
      isCurrent: period === dayjs().format('YYYY-MM'),
      disabled: (!!min && period < min) || (!!max && period > max),
    }
  })
})

function focusDay() {
  if (isMonthMode.value) {
    nextTick(() => {
      const target = panelRef.value?.querySelector<HTMLButtonElement>(`[data-period="${focusedPeriod.value}"]`)
      target?.focus()
    })
    return
  }

  nextTick(() => {
    const target = panelRef.value?.querySelector<HTMLButtonElement>(`[data-date="${focusedIso.value}"]`)
    target?.focus()
  })
}

function openPicker() {
  if (props.disabled) return
  if (isMonthMode.value) {
    const base = selectedDate.value ?? dayjs()
    visibleYear.value = base.year()
    focusedPeriod.value = selectedValue.value || base.format('YYYY-MM')
  }
  else {
    visibleMonth.value = (selectedDate.value ?? dayjs()).startOf('month')
    focusedIso.value = selectedValue.value || todayIso
  }
  isOpen.value = true
  focusDay()
}

function closePicker({ restoreFocus = true } = {}) {
  isOpen.value = false
  if (restoreFocus) nextTick(() => triggerRef.value?.focus())
}

function selectValue(value: string) {
  emit('update:modelValue', value)
  emit('change', value)
  closePicker()
}

function clearDate() {
  emit('update:modelValue', '')
  emit('change', '')
  closePicker()
}

function shiftFocus(days: number) {
  if (isMonthMode.value) {
    const next = dayjs(`${focusedPeriod.value}-01`).add(days, 'month')
    focusedPeriod.value = next.format('YYYY-MM')
    visibleYear.value = next.year()
    focusDay()
    return
  }

  const next = dayjs(focusedIso.value).add(days, 'day')
  focusedIso.value = next.format('YYYY-MM-DD')
  visibleMonth.value = next.startOf('month')
  focusDay()
}

function changeMonth(months: number) {
  if (isMonthMode.value) {
    visibleYear.value += months
    const focused = dayjs(`${focusedPeriod.value}-01`)
    const next = focused.year(visibleYear.value)
    focusedPeriod.value = next.format('YYYY-MM')
    focusDay()
    return
  }

  visibleMonth.value = visibleMonth.value.add(months, 'month')
  const focused = dayjs(focusedIso.value)
  if (focused.month() !== visibleMonth.value.month() || focused.year() !== visibleMonth.value.year()) {
    focusedIso.value = visibleMonth.value.date(Math.min(focused.date(), visibleMonth.value.daysInMonth())).format('YYYY-MM-DD')
  }
  focusDay()
}

function jumpToToday() {
  if (isMonthMode.value) {
    const period = dayjs().format('YYYY-MM')
    focusedPeriod.value = period
    visibleYear.value = Number(period.slice(0, 4))
    focusDay()
    return
  }

  focusedIso.value = todayIso
  visibleMonth.value = dayjs().startOf('month')
  focusDay()
}

function onGridKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closePicker()
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    shiftFocus(isMonthMode.value ? -1 : -1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    shiftFocus(isMonthMode.value ? 1 : 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    shiftFocus(isMonthMode.value ? -3 : -7)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    shiftFocus(isMonthMode.value ? 3 : 7)
  } else if (event.key === 'PageUp') {
    event.preventDefault()
    changeMonth(-1)
  } else if (event.key === 'PageDown') {
    event.preventDefault()
    changeMonth(1)
  } else if (event.key === 'Home') {
    event.preventDefault()
    if (isMonthMode.value) {
      focusedPeriod.value = `${visibleYear.value}-01`
      focusDay()
      return
    }
    const date = dayjs(focusedIso.value)
    shiftFocus(-((date.day() + 6) % 7))
  } else if (event.key === 'End') {
    event.preventDefault()
    if (isMonthMode.value) {
      focusedPeriod.value = `${visibleYear.value}-12`
      focusDay()
      return
    }
    const date = dayjs(focusedIso.value)
    shiftFocus(6 - ((date.day() + 6) % 7))
  } else if ((event.key === 'Enter' || event.key === ' ') && isMonthMode.value) {
    event.preventDefault()
    selectValue(focusedPeriod.value)
  }
}

onClickOutside(panelRef, () => {
  if (isOpen.value) closePicker({ restoreFocus: false })
}, { ignore: [triggerRef] })

onKeyStroke('Escape', () => {
  if (isOpen.value) closePicker()
})
</script>

<template>
  <div
    v-bind="rootDataAttrs"
    :class="['relative flex flex-col gap-1.5', rootClass]"
    :style="rootStyle"
    :data-invalid="error ? '' : undefined"
    :data-disabled="disabled ? '' : undefined"
  >
    <label
      v-if="label"
      :for="pickerId"
      class="text-sm font-medium text-muted"
    >
      {{ label }}
      <span v-if="required" class="text-error ml-0.5" aria-hidden="true">*</span>
    </label>

    <button
      v-bind="triggerAttrs"
      :id="pickerId"
      ref="triggerRef"
      type="button"
      :class="triggerClass"
      :disabled="disabled"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${pickerId}-error` : hint ? `${pickerId}-hint` : undefined"
      :aria-expanded="isOpen"
      :aria-controls="isOpen ? panelId : undefined"
      aria-haspopup="dialog"
      @click="isOpen ? closePicker({ restoreFocus: false }) : openPicker()"
      @blur="emit('blur', $event)"
    >
      <span :class="displayValue ? 'text-white' : 'text-muted'">
        {{ displayValue || placeholder }}
      </span>
      <IconCalendar class="size-4 shrink-0 text-muted" aria-hidden="true" />
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-1 scale-95"
    >
      <div
        v-if="isOpen"
        :id="panelId"
        ref="panelRef"
        role="dialog"
        :aria-label="label ?? placeholder"
        class="absolute left-0 top-full z-50 mt-2 w-72 origin-top-left rounded-xl border border-dark-border bg-dark-card p-3 shadow-xl shadow-black/40"
        @keydown="onGridKeydown"
      >
        <div class="mb-3 flex items-center justify-between gap-2">
          <UiButton
            type="button"
            variant="ghost"
            size="sm"
            icon-only
            :aria-label="isMonthMode ? 'Năm trước' : 'Tháng trước'"
            @click="changeMonth(-1)"
          >
            <IconChevronLeft class="size-4" aria-hidden="true" />
          </UiButton>
          <p class="text-sm font-semibold text-white">{{ monthLabel }}</p>
          <UiButton
            type="button"
            variant="ghost"
            size="sm"
            icon-only
            :aria-label="isMonthMode ? 'Năm sau' : 'Tháng sau'"
            @click="changeMonth(1)"
          >
            <IconChevronRight class="size-4" aria-hidden="true" />
          </UiButton>
        </div>

        <template v-if="!isMonthMode">
          <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted" aria-hidden="true">
            <span v-for="day in weekDays" :key="day">{{ day }}</span>
          </div>
          <div class="mt-1 grid grid-cols-7 gap-1">
            <button
              v-for="day in calendarDays"
              :key="day.iso"
              type="button"
              :data-date="day.iso"
              :tabindex="day.isFocused ? 0 : -1"
              :disabled="day.disabled"
              :aria-label="dayjs(day.iso).format('DD/MM/YYYY')"
              :aria-current="day.isToday ? 'date' : undefined"
              :aria-pressed="day.isSelected"
              :class="clsx(
                'flex size-8 items-center justify-center rounded-md text-xs font-medium tabular-nums transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40',
                day.isSelected
                  ? 'bg-cyan text-dark font-semibold'
                  : day.isToday
                    ? 'border border-cyan/50 text-cyan'
                    : day.inMonth
                      ? 'text-white hover:bg-dark-hover'
                      : 'text-muted/50 hover:bg-dark-hover/60',
                day.disabled && 'cursor-not-allowed opacity-30 hover:bg-transparent',
              )"
              @focus="focusedIso = day.iso"
              @click="selectValue(day.iso)"
            >
              {{ day.day }}
            </button>
          </div>
        </template>

        <div v-else class="mt-1 grid grid-cols-3 gap-2">
          <button
            v-for="month in monthCells"
            :key="month.value"
            type="button"
            :data-period="month.value"
            :tabindex="month.isFocused ? 0 : -1"
            :disabled="month.disabled"
            :aria-label="month.label"
            :aria-current="month.isCurrent ? 'date' : undefined"
            :aria-pressed="month.isSelected"
            :class="clsx(
              'flex h-9 items-center justify-center rounded-md text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40',
              month.isSelected
                ? 'bg-cyan text-dark font-semibold'
                : month.isCurrent
                  ? 'border border-cyan/50 text-cyan'
                  : 'text-white hover:bg-dark-hover',
              month.disabled && 'cursor-not-allowed opacity-30 hover:bg-transparent',
            )"
            @focus="focusedPeriod = month.value"
            @click="selectValue(month.value)"
          >
            {{ month.label }}
          </button>
        </div>

        <div class="mt-3 flex items-center justify-between border-t border-dark-border pt-3">
          <UiButton
            type="button"
            variant="ghost"
            size="sm"
            @click="jumpToToday"
          >
            {{ isMonthMode ? 'Tháng này' : 'Hôm nay' }}
          </UiButton>
          <UiButton
            v-if="clearable && !required && modelValue"
            type="button"
            variant="ghost"
            size="sm"
            @click="clearDate"
          >
            Xoá
          </UiButton>
        </div>
      </div>
    </Transition>

    <p v-if="hint && !error" :id="`${pickerId}-hint`" class="text-xs text-muted">
      {{ hint }}
    </p>
    <p v-if="error" :id="`${pickerId}-error`" class="text-xs text-error-vivid">
      {{ error }}
    </p>
  </div>
</template>
