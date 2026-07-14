import type { AiMeterImportIssue, AiMeterImportParsedRow } from '~/types/ai'

type Delimiter = '\t' | ',' | ';'
type Column = 'room' | 'electricity' | 'water'

export interface AiMeterImportParseResult {
  delimiter: Delimiter | null
  rows: AiMeterImportParsedRow[]
  issues: AiMeterImportIssue[]
}

const MAX_SOURCE_ROWS = 500

const COLUMN_ALIASES: Record<Column, ReadonlySet<string>> = {
  room: new Set(['room', 'room id', 'room number', 'phong', 'so phong']),
  electricity: new Set(['electricity', 'electric', 'dien', 'chi so dien', 'kwh']),
  water: new Set(['water', 'nuoc', 'chi so nuoc', 'm3']),
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/³/g, '3')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function columnFor(value: string): Column | null {
  const normalized = normalizeHeader(value)
  for (const [column, aliases] of Object.entries(COLUMN_ALIASES) as Array<[Column, ReadonlySet<string>]>) {
    if (aliases.has(normalized)) return column
  }
  return null
}

function delimiterFor(line: string): Delimiter | null {
  const candidates: Delimiter[] = ['\t', ';', ',']
  return candidates
    .map(delimiter => ({ delimiter, count: line.split(delimiter).length - 1 }))
    .filter(candidate => candidate.count > 0)
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? null
}

function parseValue(raw: string, line: number, field: 'electricity' | 'water', issues: AiMeterImportIssue[]): number | undefined {
  const value = raw.trim()
  if (!value) return undefined
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    issues.push({ line, field, code: 'invalid_number', message: `Giá trị ${field} không phải số không âm hợp lệ.` })
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    issues.push({ line, field, code: 'invalid_number', message: `Giá trị ${field} vượt giới hạn cho phép.` })
    return undefined
  }
  return parsed
}

export function parseMeterImportMessage(content: string): AiMeterImportParseResult {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const issues: AiMeterImportIssue[] = []

  let headerIndex = -1
  let delimiter: Delimiter | null = null
  let columns: Array<Column | null> = []

  for (let index = 0; index < lines.length; index += 1) {
    const candidateDelimiter = delimiterFor(lines[index] ?? '')
    if (!candidateDelimiter) continue
    const candidateColumns = (lines[index] ?? '').split(candidateDelimiter).map(columnFor)
    if (candidateColumns.includes('room') && (candidateColumns.includes('electricity') || candidateColumns.includes('water'))) {
      headerIndex = index
      delimiter = candidateDelimiter
      columns = candidateColumns
      break
    }
  }

  if (headerIndex < 0 || !delimiter) {
    return {
      delimiter: null,
      rows: [],
      issues: [{ line: 1, field: 'row', code: 'missing_header', message: 'Không tìm thấy hàng tiêu đề gồm phòng và ít nhất một cột điện hoặc nước.' }],
    }
  }

  const duplicateColumns = (['room', 'electricity', 'water'] as const)
    .filter(column => columns.filter(value => value === column).length > 1)
  for (const column of duplicateColumns) {
    issues.push({ line: headerIndex + 1, field: column, code: 'duplicate_column', message: `Cột ${column} xuất hiện nhiều lần.` })
  }

  const rows: AiMeterImportParsedRow[] = []
  const sourceLines = lines.slice(headerIndex + 1).filter(line => line.trim().length > 0)
  if (sourceLines.length > MAX_SOURCE_ROWS) {
    issues.push({
      line: headerIndex + MAX_SOURCE_ROWS + 2,
      field: 'row',
      code: 'too_many_rows',
      message: `Tối đa ${MAX_SOURCE_ROWS} dòng dữ liệu trong một lần nhập.`,
    })
  }

  for (let offset = 0; offset < Math.min(sourceLines.length, MAX_SOURCE_ROWS); offset += 1) {
    const source = sourceLines[offset]!
    const line = headerIndex + offset + 2
    const cells = source.split(delimiter)
    const roomIndex = columns.indexOf('room')
    const electricityIndex = columns.indexOf('electricity')
    const waterIndex = columns.indexOf('water')
    const roomReference = (cells[roomIndex] ?? '').trim()
    if (!roomReference) {
      issues.push({ line, field: 'room', code: 'missing_room', message: 'Thiếu mã hoặc số phòng.' })
    }

    const electricity = electricityIndex >= 0
      ? parseValue(cells[electricityIndex] ?? '', line, 'electricity', issues)
      : undefined
    const water = waterIndex >= 0
      ? parseValue(cells[waterIndex] ?? '', line, 'water', issues)
      : undefined

    if (electricity === undefined && water === undefined) {
      issues.push({ line, field: 'row', code: 'missing_reading', message: 'Dòng không có chỉ số điện hoặc nước.' })
    }
    rows.push({ line, roomReference, ...(electricity !== undefined && { electricity }), ...(water !== undefined && { water }) })
  }

  if (rows.length === 0) {
    issues.push({ line: headerIndex + 2, field: 'row', code: 'missing_rows', message: 'Không có dòng dữ liệu chỉ số.' })
  }

  return { delimiter, rows, issues }
}
