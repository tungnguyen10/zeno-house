import type { BillingDraftGridRow, BillingDraftGridUtilityCell } from '~/types/billing'

export type BulkReadingMode = 'auto' | 'ordered' | 'room'
export type ResolvedBulkReadingMode = 'ordered' | 'room'
export type MeterType = 'electricity' | 'water'

export type BulkReadingCellStatus =
  | 'accepted'
  | 'skipped'
  | 'invalid'
  | 'warning'
  | 'read_only'
  | 'not_applicable'
  /** Lower than the previous reading — excluded from apply, does not block other rows. */
  | 'below_previous'
  | 'usage_spike'
  | 'usage_drop'
  | 'zero_usage'

export type BulkReadingLineStatus =
  | 'accepted'
  | 'skipped'
  | 'warning'
  | 'rejected'
  | 'error'

/** Default percent deviation from the prior period's usage that triggers a spike/drop warning. */
export const DEFAULT_USAGE_WARNING_PERCENT = 50

/** Converts a percent deviation into the multipliers used to detect a usage spike or drop. */
export function usageWarningRatios(percent: number): { spikeRatio: number; dropRatio: number } {
  const clamped = Math.min(500, Math.max(1, percent))
  return {
    spikeRatio: 1 + clamped / 100,
    dropRatio: Math.max(0, 1 - clamped / 100),
  }
}

export interface ParsedBulkReadingLine {
  lineNumber: number
  raw: string
  tokens: string[]
  blank: boolean
}

export interface BulkReadingPreviewCell {
  type: MeterType
  raw: string | null
  value: string | null
  status: BulkReadingCellStatus
  message: string
  blocking: boolean
}

export interface BulkReadingPreviewLine {
  lineNumber: number
  raw: string
  mode: ResolvedBulkReadingMode
  row: BillingDraftGridRow | null
  roomToken: string | null
  roomNumber: string | null
  status: BulkReadingLineStatus
  message: string
  cells: {
    electricity: BulkReadingPreviewCell
    water: BulkReadingPreviewCell
  }
}

export interface BulkReadingPreview {
  mode: ResolvedBulkReadingMode
  ambiguous: boolean
  lines: BulkReadingPreviewLine[]
  applyCount: number
  blockingCount: number
  warningCount: number
  rejectedCount: number
}

export interface BuildBulkReadingPreviewOptions {
  mode?: BulkReadingMode
  /** Percent deviation from the prior period's usage that triggers a spike/drop warning. Defaults to 50. */
  usageWarningPercent?: number
}

const SKIP_MARKER = '-'

export function parseBulkReadingLines(raw: string): ParsedBulkReadingLine[] {
  if (!raw) return []
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') {
    lines.pop()
  }
  return lines.map((line, index) => {
    const trimmed = line.trim()
    return {
      lineNumber: index + 1,
      raw: line,
      tokens: trimmed === '' ? [] : trimmed.split(/[\t ]+/).filter(Boolean),
      blank: trimmed === '',
    }
  })
}

export function buildBulkReadingPreview(
  raw: string,
  rows: BillingDraftGridRow[],
  options: BuildBulkReadingPreviewOptions = {},
): BulkReadingPreview {
  const parsed = parseBulkReadingLines(raw)
  const roomMap = buildRoomMap(rows)
  const detected = resolveMode(parsed, roomMap, options.mode ?? 'auto')
  const usageWarningPercent = options.usageWarningPercent ?? DEFAULT_USAGE_WARNING_PERCENT
  const seenRoomIds = new Map<string, number>()
  const lines = parsed.map((line, index) => {
    const target = detected.mode === 'room'
      ? roomMap.get(normalizeRoomToken(line.tokens[0] ?? '')) ?? null
      : rows[index] ?? null
    const roomToken = detected.mode === 'room' && !line.blank ? line.tokens[0] ?? null : null
    const readingTokens = detected.mode === 'room' ? line.tokens.slice(1) : line.tokens

    return buildPreviewLine(line, detected.mode, target, roomToken, readingTokens, seenRoomIds, usageWarningPercent)
  })

  const applyCount = lines.reduce((sum, line) =>
    sum + countAccepted(line.cells.electricity) + countAccepted(line.cells.water), 0)
  const blockingCount = lines.reduce((sum, line) =>
    sum + Number(line.cells.electricity.blocking) + Number(line.cells.water.blocking), 0)
  const warningCount = lines.reduce((sum, line) =>
    sum + Number(isWarningLikeStatus(line.cells.electricity.status)) + Number(isWarningLikeStatus(line.cells.water.status)), 0)
  const rejectedCount = lines.reduce((sum, line) =>
    sum + Number(line.cells.electricity.status === 'below_previous') + Number(line.cells.water.status === 'below_previous'), 0)

  return {
    mode: detected.mode,
    ambiguous: detected.ambiguous,
    lines,
    applyCount,
    blockingCount,
    warningCount,
    rejectedCount,
  }
}

export function acceptedBulkReadingUpdates(preview: BulkReadingPreview): Array<{
  row: BillingDraftGridRow
  type: MeterType
  value: string
}> {
  const updates: Array<{ row: BillingDraftGridRow; type: MeterType; value: string }> = []
  for (const line of preview.lines) {
    if (!line.row) continue
    for (const type of ['electricity', 'water'] as MeterType[]) {
      const cell = line.cells[type]
      if ((cell.status === 'accepted' || isWarningLikeStatus(cell.status)) && cell.value !== null) {
        updates.push({ row: line.row, type, value: cell.value })
      }
    }
  }
  return updates
}

export function normalizeBulkReadingValue(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed === '') return ''
  if (/^[\d.,\s]+$/.test(trimmed)) {
    const compact = trimmed.replace(/\s+/g, '')
    const hasComma = compact.includes(',')
    const hasDot = compact.includes('.')
    if (hasComma && hasDot) return compact.replace(/\./g, '').replace(',', '.')
    if (hasComma) return compact.replace(',', '.')
    return compact
  }
  return trimmed
}

function resolveMode(
  lines: ParsedBulkReadingLine[],
  roomMap: Map<string, BillingDraftGridRow>,
  requested: BulkReadingMode,
): { mode: ResolvedBulkReadingMode; ambiguous: boolean } {
  if (requested === 'ordered' || requested === 'room') {
    return { mode: requested, ambiguous: false }
  }
  const meaningful = lines.filter(line => !line.blank)
  const roomMatches = meaningful.filter(line => roomMap.has(normalizeRoomToken(line.tokens[0] ?? '')))
  const numericFirstTokens = meaningful.filter(line => /^\d+(?:[.,]\d+)?$/.test(line.tokens[0] ?? ''))
  return {
    mode: roomMatches.length > 0 ? 'room' : 'ordered',
    ambiguous: roomMatches.length > 0 && numericFirstTokens.length > 0,
  }
}

function buildPreviewLine(
  line: ParsedBulkReadingLine,
  mode: ResolvedBulkReadingMode,
  row: BillingDraftGridRow | null,
  roomToken: string | null,
  readingTokens: string[],
  seenRoomIds: Map<string, number>,
  usageWarningPercent: number,
): BulkReadingPreviewLine {
  if (line.blank) {
    return previewLine(line, mode, row, roomToken, 'skipped', 'Bỏ qua dòng trống')
  }

  if (!row) {
    return previewLine(line, mode, null, roomToken, 'error', mode === 'room' ? 'Không tìm thấy phòng' : 'Không có phòng tương ứng')
  }

  if (mode === 'room' && readingTokens.length === 0) {
    return previewLine(line, mode, row, roomToken, 'skipped', 'Bỏ qua phòng này')
  }

  const previousLine = seenRoomIds.get(row.roomId)
  if (previousLine !== undefined) {
    return previewLine(line, mode, row, roomToken, 'error', `Trùng phòng với dòng ${previousLine}`)
  }
  seenRoomIds.set(row.roomId, line.lineNumber)

  const electricity = validateCell(row, 'electricity', readingTokens[0] ?? null, usageWarningPercent)
  const water = validateCell(row, 'water', readingTokens[1] ?? null, usageWarningPercent)
  const cells = { electricity, water }
  const blocking = electricity.blocking || water.blocking
  const rejected = !blocking && (electricity.status === 'below_previous' || water.status === 'below_previous')
  const warning = !blocking && !rejected && (isWarningLikeStatus(electricity.status) || isWarningLikeStatus(water.status))
  const accepted = electricity.status === 'accepted' || water.status === 'accepted'
  const skipped = electricity.status === 'skipped' && water.status === 'skipped'
  const status: BulkReadingLineStatus = blocking ? 'error' : rejected ? 'rejected' : warning ? 'warning' : accepted ? 'accepted' : skipped ? 'skipped' : 'accepted'
  return {
    lineNumber: line.lineNumber,
    raw: line.raw,
    mode,
    row,
    roomToken,
    roomNumber: row.roomNumber,
    status,
    message: buildLineMessage(status, cells),
    cells,
  }
}

function previewLine(
  line: ParsedBulkReadingLine,
  mode: ResolvedBulkReadingMode,
  row: BillingDraftGridRow | null,
  roomToken: string | null,
  status: BulkReadingLineStatus,
  message: string,
): BulkReadingPreviewLine {
  const blocking = status === 'error'
  return {
    lineNumber: line.lineNumber,
    raw: line.raw,
    mode,
    row,
    roomToken,
    roomNumber: row?.roomNumber ?? null,
    status,
    message,
    cells: {
      electricity: emptyCell('electricity', blocking, message),
      water: emptyCell('water', blocking, message),
    },
  }
}

function validateCell(row: BillingDraftGridRow, type: MeterType, raw: string | null, usageWarningPercent: number): BulkReadingPreviewCell {
  if (raw === null || raw.trim() === '' || raw.trim() === SKIP_MARKER) {
    return {
      type,
      raw,
      value: null,
      status: 'skipped',
      message: 'Bỏ qua',
      blocking: false,
    }
  }

  const meter = row[type] as BillingDraftGridUtilityCell | null
  if (!row.editable || !meter?.editable) {
    const notApplicable = meter && !meter.required
    return {
      type,
      raw,
      value: null,
      status: notApplicable ? 'not_applicable' : 'read_only',
      message: notApplicable ? 'Không áp dụng' : 'Không thể sửa',
      blocking: !notApplicable,
    }
  }

  const value = normalizeBulkReadingValue(raw)
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return { type, raw, value: null, status: 'invalid', message: 'Giá trị không hợp lệ', blocking: true }
  }
  if (numeric < 0) {
    return { type, raw, value: null, status: 'invalid', message: 'Không được âm', blocking: true }
  }

  if (meter.previousValue !== null) {
    if (numeric < meter.previousValue) {
      return {
        type,
        raw,
        value: null,
        status: 'below_previous',
        message: `Nhỏ hơn chỉ số cũ (mới ${formatReadingNumber(numeric)}, cũ ${formatReadingNumber(meter.previousValue)})`,
        blocking: false,
      }
    }
    const usage = numeric - meter.previousValue
    if (usage === 0) {
      const priorNote = meter.previousUsage !== null ? ` (kỳ trước dùng ${formatUsageNumber(meter.previousUsage, type)})` : ''
      return { type, raw, value, status: 'zero_usage', message: `Không tiêu thụ kỳ này${priorNote}`, blocking: false }
    }
    if (meter.previousUsage !== null && meter.previousUsage > 0) {
      const { spikeRatio, dropRatio } = usageWarningRatios(usageWarningPercent)
      if (usage > meter.previousUsage * spikeRatio) {
        return {
          type,
          raw,
          value,
          status: 'usage_spike',
          message: `Tăng hơn ${usageWarningPercent}% so với kỳ trước (kỳ này ${formatUsageNumber(usage, type)}, kỳ trước ${formatUsageNumber(meter.previousUsage, type)})`,
          blocking: false,
        }
      }
      if (usage < meter.previousUsage * dropRatio) {
        return {
          type,
          raw,
          value,
          status: 'usage_drop',
          message: `Giảm hơn ${usageWarningPercent}% so với kỳ trước (kỳ này ${formatUsageNumber(usage, type)}, kỳ trước ${formatUsageNumber(meter.previousUsage, type)})`,
          blocking: false,
        }
      }
    }
  }

  return { type, raw, value, status: 'accepted', message: 'Sẽ cập nhật', blocking: false }
}

function emptyCell(type: MeterType, blocking: boolean, message: string): BulkReadingPreviewCell {
  return {
    type,
    raw: null,
    value: null,
    status: blocking ? 'invalid' : 'skipped',
    message,
    blocking,
  }
}

function countAccepted(cell: BulkReadingPreviewCell): number {
  return cell.status === 'accepted' || isWarningLikeStatus(cell.status) ? 1 : 0
}

function isWarningLikeStatus(status: BulkReadingCellStatus): boolean {
  return status === 'warning' || status === 'usage_spike' || status === 'usage_drop' || status === 'zero_usage'
}

function formatReadingNumber(value: number): string {
  return value.toLocaleString('vi-VN')
}

function formatUsageNumber(value: number, type: MeterType): string {
  const unit = type === 'electricity' ? 'kWh' : 'm³'
  return `${value.toLocaleString('vi-VN')} ${unit}`
}

const METER_LABEL: Record<MeterType, string> = { electricity: 'Điện', water: 'Nước' }

/** Surfaces the specific per-meter reason instead of a generic warning/error label. */
function buildLineMessage(
  status: BulkReadingLineStatus,
  cells: { electricity: BulkReadingPreviewCell; water: BulkReadingPreviewCell },
): string {
  if (status === 'accepted') return 'Sẽ cập nhật'
  if (status === 'skipped') return 'Bỏ qua'

  const reasons = (['electricity', 'water'] as MeterType[])
    .map(type => cells[type])
    .filter(cell => cell.status !== 'accepted' && cell.status !== 'skipped' && cell.status !== 'not_applicable')
    .map(cell => `${METER_LABEL[cell.type]}: ${cell.message}`)

  if (reasons.length > 0) return reasons.join(' · ')
  return status === 'error' ? 'Cần kiểm tra lại' : status === 'rejected' ? 'Có số bị loại' : 'Có cảnh báo'
}

function buildRoomMap(rows: BillingDraftGridRow[]): Map<string, BillingDraftGridRow> {
  const map = new Map<string, BillingDraftGridRow>()
  for (const row of rows) {
    const key = normalizeRoomToken(row.roomNumber ?? '')
    if (key && !map.has(key)) map.set(key, row)
  }
  return map
}

function normalizeRoomToken(value: string): string {
  return value.trim().toLocaleLowerCase('vi-VN')
}
