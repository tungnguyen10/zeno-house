import type { BillingDraftGridRow, BillingDraftGridUtilityCell } from '~/types/billing'
import { DEFAULT_USAGE_WARNING_PERCENT, usageWarningRatios } from './bulk-readings'

export type MeterType = 'electricity' | 'water'

function formatReadingNumber(value: number): string {
  return value.toLocaleString('vi-VN')
}

function formatUsageNumber(value: number, type: MeterType): string {
  const unit = type === 'electricity' ? 'kWh' : 'm³'
  return `${value.toLocaleString('vi-VN')} ${unit}`
}

export type OptimisticCellStatus =
  | 'stored'
  | 'pending'
  | 'empty'
  | 'invalid'
  /** Lower than the previous reading — excluded from totals and not saved. */
  | 'below_previous'
  | 'usage_spike'
  | 'usage_drop'
  | 'zero_usage'
  | 'not_applicable'
  | 'unsupported'

export interface OptimisticUtilityDisplay {
  cell: BillingDraftGridUtilityCell | null
  currentValue: number | null
  currentText: string
  usage: number | null
  amount: number | null
  status: OptimisticCellStatus
  message: string | null
}

export interface OptimisticRowDisplay {
  electricity: OptimisticUtilityDisplay
  water: OptimisticUtilityDisplay
  draftTotal: number | null
}

export function optimisticRowDisplay(
  row: BillingDraftGridRow,
  localReadings: Record<string, string>,
): OptimisticRowDisplay {
  const electricity = optimisticUtilityDisplay(row, 'electricity', localReadings)
  const water = optimisticUtilityDisplay(row, 'water', localReadings)
  const draftTotal = deriveDraftTotal(row, electricity, water)
  return { electricity, water, draftTotal }
}

export function optimisticUtilityDisplay(
  row: BillingDraftGridRow,
  type: MeterType,
  localReadings: Record<string, string>,
): OptimisticUtilityDisplay {
  const cell = row[type] as BillingDraftGridUtilityCell | null
  if (!cell) return emptyDisplay(null, 'not_applicable', null)

  const local = localReadings[`${row.roomId}::${type}`]
  if (local === undefined) {
    return {
      cell,
      currentValue: cell.currentValue,
      currentText: cell.currentValue !== null ? String(cell.currentValue) : '',
      usage: cell.usage,
      amount: cell.amount,
      status: cell.source === 'not_applicable' ? 'not_applicable' : 'stored',
      message: null,
    }
  }

  const trimmed = local.trim()
  if (trimmed === '') {
    return emptyDisplay(cell, 'empty', 'Chưa có chỉ số mới')
  }

  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return {
      ...emptyDisplay(cell, 'invalid', 'Giá trị không hợp lệ'),
      currentText: local,
    }
  }

  if (!cell.required || cell.source === 'fixed' || cell.source === 'per_person' || cell.source === 'not_applicable') {
    return {
      cell,
      currentValue: numeric,
      currentText: String(numeric),
      usage: cell.usage,
      amount: cell.amount,
      status: 'not_applicable',
      message: 'Không cần nhập chỉ số',
    }
  }

  if (cell.rate === null || cell.previousValue === null) {
    return {
      cell,
      currentValue: numeric,
      currentText: String(numeric),
      usage: null,
      amount: null,
      status: 'unsupported',
      message: cell.previousValue === null ? 'Thiếu chỉ số cũ' : 'Thiếu đơn giá',
    }
  }

  const usage = numeric - cell.previousValue
  if (usage < 0) {
    return {
      cell,
      currentValue: numeric,
      currentText: String(numeric),
      usage,
      amount: null,
      status: 'below_previous',
      message: `Nhỏ hơn chỉ số cũ (mới ${formatReadingNumber(numeric)}, cũ ${formatReadingNumber(cell.previousValue)})`,
    }
  }
  if (usage === 0) {
    const priorNote = cell.previousUsage !== null ? ` (kỳ trước dùng ${formatUsageNumber(cell.previousUsage, type)})` : ''
    return {
      cell,
      currentValue: numeric,
      currentText: String(numeric),
      usage,
      amount: 0,
      status: 'zero_usage',
      message: `Không tiêu thụ kỳ này${priorNote}`,
    }
  }
  if (cell.previousUsage !== null && cell.previousUsage > 0) {
    const { spikeRatio, dropRatio } = usageWarningRatios(DEFAULT_USAGE_WARNING_PERCENT)
    if (usage > cell.previousUsage * spikeRatio) {
      return {
        cell,
        currentValue: numeric,
        currentText: String(numeric),
        usage,
        amount: Math.round(usage * cell.rate),
        status: 'usage_spike',
        message: `Tăng hơn ${DEFAULT_USAGE_WARNING_PERCENT}% so với kỳ trước (kỳ này ${formatUsageNumber(usage, type)}, kỳ trước ${formatUsageNumber(cell.previousUsage, type)})`,
      }
    }
    if (usage < cell.previousUsage * dropRatio) {
      return {
        cell,
        currentValue: numeric,
        currentText: String(numeric),
        usage,
        amount: Math.round(usage * cell.rate),
        status: 'usage_drop',
        message: `Giảm hơn ${DEFAULT_USAGE_WARNING_PERCENT}% so với kỳ trước (kỳ này ${formatUsageNumber(usage, type)}, kỳ trước ${formatUsageNumber(cell.previousUsage, type)})`,
      }
    }
  }

  return {
    cell,
    currentValue: numeric,
    currentText: String(numeric),
    usage,
    amount: Math.round(usage * cell.rate),
    status: 'pending',
    message: null,
  }
}

export function formatOptimisticUsage(display: OptimisticUtilityDisplay): string {
  const cell = display.cell
  if (!cell) return '—'
  if (display.status === 'invalid' || display.status === 'empty') return '—'
  if (
    display.status === 'below_previous'
    || display.status === 'usage_spike'
    || display.status === 'usage_drop'
    || display.status === 'zero_usage'
  ) {
    return display.message ?? 'Cần kiểm tra'
  }
  if (cell.source === 'fixed') return 'Cố định'
  if (cell.source === 'per_person') return display.usage !== null ? `${display.usage} người` : '—'
  if (cell.source === 'not_applicable') return '—'
  if (display.usage === null) return '—'
  const unit = cell.meterType === 'electricity' ? 'kWh' : 'm³'
  return `${display.usage} ${unit}`
}

function deriveDraftTotal(
  row: BillingDraftGridRow,
  electricity: OptimisticUtilityDisplay,
  water: OptimisticUtilityDisplay,
): number | null {
  const hasLocal = electricity.status !== 'stored' || water.status !== 'stored'
  if (!hasLocal) return row.draftTotal
  if (electricity.status === 'invalid' || electricity.status === 'empty' || electricity.status === 'below_previous') return null
  if (water.status === 'invalid' || water.status === 'empty' || water.status === 'below_previous') return null

  const electricityAmount = electricity.amount ?? 0
  const waterAmount = water.amount ?? 0
  return row.rentAndServiceTotal + electricityAmount + waterAmount
}

function emptyDisplay(
  cell: BillingDraftGridUtilityCell | null,
  status: OptimisticCellStatus,
  message: string | null,
): OptimisticUtilityDisplay {
  return {
    cell,
    currentValue: null,
    currentText: '',
    usage: null,
    amount: null,
    status,
    message,
  }
}
