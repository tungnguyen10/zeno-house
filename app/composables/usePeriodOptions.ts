import { computed, toValue, watch } from 'vue'
import type { MaybeRef, Ref } from 'vue'

export interface PeriodPoint {
  year: number
  month: number
}

interface YearWindow {
  past: number
  future: number
}

interface PeriodOption {
  value: number
  label: string
}

interface UsePeriodOptionsParams {
  selectedYear?: MaybeRef<number | null | undefined>
  minPeriod?: MaybeRef<PeriodPoint | null | undefined>
  maxPeriod?: MaybeRef<PeriodPoint | null | undefined>
  yearWindow?: MaybeRef<YearWindow | null | undefined>
  baseDate?: MaybeRef<Date>
}

const DEFAULT_YEAR_WINDOW: YearWindow = {
  past: 1,
  future: 1,
}

function normalizeMonth(value: number): number {
  return Math.max(1, Math.min(12, Math.trunc(value)))
}

function normalizePeriod(value: PeriodPoint | null | undefined): PeriodPoint | null {
  if (!value) return null
  if (!Number.isFinite(value.year) || !Number.isFinite(value.month)) return null
  return {
    year: Math.trunc(value.year),
    month: normalizeMonth(value.month),
  }
}

export function usePeriodOptions(params: UsePeriodOptionsParams = {}): {
  yearOptions: Readonly<Ref<PeriodOption[]>>
  monthOptions: Readonly<Ref<PeriodOption[]>>
  normalizeSelection: (yearRef: Ref<number>, monthRef: Ref<number>) => void
} {
  const baseDate = computed(() => toValue(params.baseDate) ?? new Date())
  const currentYear = computed(() => baseDate.value.getFullYear())
  const selectedYear = computed(() => {
    const value = toValue(params.selectedYear)
    return Number.isFinite(value) ? Math.trunc(Number(value)) : null
  })
  const yearWindow = computed(() => ({
    past: toValue(params.yearWindow)?.past ?? DEFAULT_YEAR_WINDOW.past,
    future: toValue(params.yearWindow)?.future ?? DEFAULT_YEAR_WINDOW.future,
  }))
  const minPeriod = computed(() => normalizePeriod(toValue(params.minPeriod)))
  const maxPeriod = computed(() => normalizePeriod(toValue(params.maxPeriod)))

  const yearOptions = computed<PeriodOption[]>(() => {
    let minYear = currentYear.value - yearWindow.value.past
    let maxYear = currentYear.value + yearWindow.value.future

    if (minPeriod.value) minYear = Math.min(minYear, minPeriod.value.year)
    if (maxPeriod.value) maxYear = Math.max(maxYear, maxPeriod.value.year)
    if (minYear > maxYear) return []

    const options: PeriodOption[] = []
    for (let year = minYear; year <= maxYear; year++) {
      if (minPeriod.value && year < minPeriod.value.year) continue
      if (maxPeriod.value && year > maxPeriod.value.year) continue
      options.push({
        value: year,
        label: String(year),
      })
    }

    return options
  })

  const monthOptions = computed<PeriodOption[]>(() => {
    const year = selectedYear.value
    if (year === null) {
      return Array.from({ length: 12 }, (_, idx) => ({
        value: idx + 1,
        label: `Tháng ${idx + 1}`,
      }))
    }

    if (minPeriod.value && year < minPeriod.value.year) return []
    if (maxPeriod.value && year > maxPeriod.value.year) return []

    const startMonth =
      minPeriod.value && year === minPeriod.value.year
        ? minPeriod.value.month
        : 1
    const endMonth =
      maxPeriod.value && year === maxPeriod.value.year
        ? maxPeriod.value.month
        : 12

    if (startMonth > endMonth) return []

    return Array.from({ length: endMonth - startMonth + 1 }, (_, idx) => ({
      value: startMonth + idx,
      label: `Tháng ${startMonth + idx}`,
    }))
  })

  function normalizeSelection(yearRef: Ref<number>, monthRef: Ref<number>) {
    watch(yearOptions, (options) => {
      if (options.length === 0) return
      const availableYears = options.map(option => option.value)
      if (!availableYears.includes(yearRef.value)) {
        yearRef.value = options[0]!.value
      }
    }, { immediate: true })

    watch([() => yearRef.value, monthOptions], ([, options]) => {
      if (options.length === 0) return
      const availableMonths = options.map(option => option.value)
      if (!availableMonths.includes(monthRef.value)) {
        monthRef.value = options[0]!.value
      }
    }, { immediate: true })
  }

  return {
    yearOptions,
    monthOptions,
    normalizeSelection,
  }
}