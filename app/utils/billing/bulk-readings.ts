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

export type BulkReadingLineStatus =
  | 'accepted'
  | 'skipped'
  | 'warning'
  | 'error'

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
}

export interface BuildBulkReadingPreviewOptions {
  mode?: BulkReadingMode
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
  const seenRoomIds = new Map<string, number>()
  const lines = parsed.map((line, index) => {
    const target = detected.mode === 'room'
      ? roomMap.get(normalizeRoomToken(line.tokens[0] ?? '')) ?? null
      : rows[index] ?? null
    const roomToken = detected.mode === 'room' && !line.blank ? line.tokens[0] ?? null : null
    const readingTokens = detected.mode === 'room' ? line.tokens.slice(1) : line.tokens

    return buildPreviewLine(line, detected.mode, target, roomToken, readingTokens, seenRoomIds)
  })

  const applyCount = lines.reduce((sum, line) =>
    sum + countAccepted(line.cells.electricity) + countAccepted(line.cells.water), 0)
  const blockingCount = lines.reduce((sum, line) =>
    sum + Number(line.cells.electricity.blocking) + Number(line.cells.water.blocking), 0)
  const warningCount = lines.reduce((sum, line) =>
    sum + Number(line.cells.electricity.status === 'warning') + Number(line.cells.water.status === 'warning'), 0)

  return {
    mode: detected.mode,
    ambiguous: detected.ambiguous,
    lines,
    applyCount,
    blockingCount,
    warningCount,
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
      if ((cell.status === 'accepted' || cell.status === 'warning') && cell.value !== null) {
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

  const electricity = validateCell(row, 'electricity', readingTokens[0] ?? null)
  const water = validateCell(row, 'water', readingTokens[1] ?? null)
  const cells = { electricity, water }
  const blocking = electricity.blocking || water.blocking
  const warning = electricity.status === 'warning' || water.status === 'warning'
  const accepted = electricity.status === 'accepted' || water.status === 'accepted'
  const skipped = electricity.status === 'skipped' && water.status === 'skipped'
  return {
    lineNumber: line.lineNumber,
    raw: line.raw,
    mode,
    row,
    roomToken,
    roomNumber: row.roomNumber,
    status: blocking ? 'error' : warning ? 'warning' : accepted ? 'accepted' : skipped ? 'skipped' : 'accepted',
    message: blocking ? 'Cần kiểm tra lại' : warning ? 'Có cảnh báo' : accepted ? 'Sẽ cập nhật' : 'Bỏ qua',
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

function validateCell(row: BillingDraftGridRow, type: MeterType, raw: string | null): BulkReadingPreviewCell {
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
  if (meter.previousValue !== null && numeric < meter.previousValue) {
    return { type, raw, value, status: 'warning', message: 'Nhỏ hơn chỉ số cũ', blocking: false }
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
  return cell.status === 'accepted' || cell.status === 'warning' ? 1 : 0
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
