const DEFAULT_DUE_AFTER_DAYS = 4

export type InvoiceDueSource = 'override' | 'contract' | 'building' | 'system'

export interface ResolveInvoiceDueScheduleInput {
  calculationDate: string
  dueDateOverride?: string | null
  contractPaymentDueDay?: number | null
  buildingPaymentDueDay?: number | null
  gracePeriodDays: number
}

export interface InvoiceDueSchedule {
  dueDate: string
  gracePeriodDays: number
  overdueDate: string
  source: InvoiceDueSource
}

function parseDate(value: string): { year: number, month: number, day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throwValidationError('Ngày tính hạn thanh toán không hợp lệ')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throwValidationError('Ngày tính hạn thanh toán không hợp lệ')
  }
  return { year, month, day }
}

function formatDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function addCalendarDays(value: string, days: number): string {
  const parsed = parseDate(value)
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
  return date.toISOString().slice(0, 10)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function dueDateForDay(calculationDate: string, dueDay: number): string {
  const parsed = parseDate(calculationDate)
  const currentDay = Math.min(dueDay, daysInMonth(parsed.year, parsed.month))
  const currentCandidate = formatDate(parsed.year, parsed.month, currentDay)
  if (currentCandidate >= calculationDate) return currentCandidate

  const nextMonthDate = new Date(Date.UTC(parsed.year, parsed.month, 1))
  const nextYear = nextMonthDate.getUTCFullYear()
  const nextMonth = nextMonthDate.getUTCMonth() + 1
  return formatDate(nextYear, nextMonth, Math.min(dueDay, daysInMonth(nextYear, nextMonth)))
}

export function calculationDateInHoChiMinh(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function resolveInvoiceDueSchedule(input: ResolveInvoiceDueScheduleInput): InvoiceDueSchedule {
  parseDate(input.calculationDate)
  if (!Number.isInteger(input.gracePeriodDays) || input.gracePeriodDays < 0) {
    throwValidationError('Số ngày gia hạn không hợp lệ')
  }

  let dueDate: string
  let source: InvoiceDueSource

  if (input.dueDateOverride) {
    parseDate(input.dueDateOverride)
    if (input.dueDateOverride < input.calculationDate) {
      throwValidationError('Hạn thanh toán không được trước ngày phát hành')
    }
    dueDate = input.dueDateOverride
    source = 'override'
  }
  else {
    const dueDay = input.contractPaymentDueDay ?? input.buildingPaymentDueDay
    if (dueDay !== null && dueDay !== undefined) {
      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        throwValidationError('Ngày đến hạn phải từ 1 đến 31')
      }
      dueDate = dueDateForDay(input.calculationDate, dueDay)
      source = input.contractPaymentDueDay !== null && input.contractPaymentDueDay !== undefined
        ? 'contract'
        : 'building'
    }
    else {
      dueDate = addCalendarDays(input.calculationDate, DEFAULT_DUE_AFTER_DAYS)
      source = 'system'
    }
  }

  return {
    dueDate,
    gracePeriodDays: input.gracePeriodDays,
    overdueDate: addCalendarDays(dueDate, input.gracePeriodDays),
    source,
  }
}
