import ExcelJS from 'exceljs'
import { z } from 'zod'
import type { TenantBulkCreateRowInput } from '~/utils/validators/tenants'

const parseImportBodySchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1),
})

const FIELD_NAMES = [
  'full_name',
  'phone',
  'email',
  'id_number',
  'date_of_birth',
  'gender',
  'occupation',
  'id_issued_date',
  'id_issued_place',
  'emergency_contact_name',
  'emergency_contact_phone',
  'permanent_address',
  'notes',
] as const

type FieldName = (typeof FIELD_NAMES)[number]

const HEADER_ALIASES: Record<FieldName, string[]> = {
  full_name: ['full_name', 'name', 'ho_ten', 'hoten', 'ho_va_ten', 'ten_khach_thue'],
  phone: ['phone', 'mobile', 'so_dien_thoai', 'sdt', 'so_dien_thoai_lien_he'],
  email: ['email'],
  id_number: ['id_number', 'cmnd', 'cccd', 'identity_number', 'cmnd_cccd', 'so_cmnd_cccd'],
  date_of_birth: ['date_of_birth', 'dob', 'ngay_sinh'],
  gender: ['gender', 'gioi_tinh'],
  occupation: ['occupation', 'nghe_nghiep'],
  id_issued_date: ['id_issued_date', 'ngay_cap'],
  id_issued_place: ['id_issued_place', 'noi_cap'],
  emergency_contact_name: ['emergency_contact_name', 'ten_lien_he_khan_cap', 'nguoi_lien_he_khan_cap'],
  emergency_contact_phone: ['emergency_contact_phone', 'sdt_lien_he_khan_cap', 'so_dien_thoai_lien_he_khan_cap'],
  permanent_address: ['permanent_address', 'dia_chi_thuong_tru'],
  notes: ['notes', 'ghi_chu'],
}

const REQUIRED_FIELD_LABELS: Record<'full_name' | 'phone', string> = {
  full_name: 'Họ và tên',
  phone: 'Số điện thoại',
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
}

function normalizeCell(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

function rowIsEmpty(cells: string[]): boolean {
  return cells.every(c => !c || c.trim() === '')
}

function excelCellToText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (typeof o['text'] === 'string') return o['text']
    if (o['result'] !== undefined) return String(o['result'])
  }
  return String(value)
}

function parseCsvMatrix(text: string): string[][] {
  const matrix: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') { cell += '"'; i++ }
      else inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) { row.push(cell); cell = ''; continue }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++
      row.push(cell); matrix.push(row); row = []; cell = ''
      continue
    }
    cell += char
  }

  if (cell.length > 0 || row.length > 0) { row.push(cell); matrix.push(row) }
  return matrix
}

function buildFieldIndexes(headers: string[]): Map<FieldName, number> {
  const map = new Map<FieldName, number>()
  for (const field of FIELD_NAMES) {
    const idx = headers.findIndex(h => HEADER_ALIASES[field].includes(h))
    if (idx >= 0) map.set(field, idx)
  }
  return map
}

function buildRowsFromMatrix(matrix: string[][]): { rows: TenantBulkCreateRowInput[]; parseError: string | null } {
  if (matrix.length === 0) return { rows: [], parseError: 'File không có dữ liệu.' }

  const headers = matrix[0]!.map(normalizeHeader)
  const indexByField = buildFieldIndexes(headers)

  const missing = (['full_name', 'phone'] as const)
    .filter(f => !indexByField.has(f))
    .map(f => REQUIRED_FIELD_LABELS[f])

  if (missing.length > 0) {
    return { rows: [], parseError: `Thiếu cột bắt buộc: ${missing.join(', ')}` }
  }

  const rows: TenantBulkCreateRowInput[] = []
  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] ?? []
    if (rowIsEmpty(line)) continue
    const get = (f: FieldName) => normalizeCell(line[indexByField.get(f) ?? -1])
    rows.push({
      line: i + 1,
      full_name: get('full_name'),
      phone: get('phone'),
      email: get('email'),
      id_number: get('id_number'),
      date_of_birth: get('date_of_birth'),
      gender: get('gender'),
      occupation: get('occupation'),
      id_issued_date: get('id_issued_date'),
      id_issued_place: get('id_issued_place'),
      emergency_contact_name: get('emergency_contact_name'),
      emergency_contact_phone: get('emergency_contact_phone'),
      permanent_address: get('permanent_address'),
      notes: get('notes'),
    })
  }

  if (rows.length === 0) return { rows: [], parseError: 'Không tìm thấy dòng dữ liệu hợp lệ trong file.' }
  return { rows, parseError: null }
}

async function xlsxToMatrix(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook()
  // ExcelJS typings expect Node.js Buffer; cast to satisfy strict TS
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])

  let fallback: string[][] | null = null

  for (const sheet of workbook.worksheets) {
    const matrix: string[][] = []
    sheet.eachRow((row) => {
      const values = row.values as unknown[]
      matrix.push(values.slice(1).map(excelCellToText))
    })
    if (matrix.length === 0) continue
    if (!fallback) fallback = matrix

    const indexes = buildFieldIndexes(matrix[0]!.map(normalizeHeader))
    if (indexes.has('full_name') && indexes.has('phone')) return matrix
  }

  return fallback ?? []
}

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const raw = await readBody(event)
  const parsed = parseImportBodySchema.safeParse(raw)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      data: { error: { code: 'VALIDATION_ERROR', message: 'Thiếu dữ liệu file.' } },
    })
  }

  const { filename, content } = parsed.data
  const lower = filename.toLowerCase()

  try {
    let matrix: string[][]

    if (lower.endsWith('.csv')) {
      matrix = parseCsvMatrix(content)
    }
    else if (lower.endsWith('.xlsx')) {
      const buffer = Buffer.from(content, 'base64')
      matrix = await xlsxToMatrix(buffer)
    }
    else {
      throw createError({
        statusCode: 400,
        data: { error: { code: 'VALIDATION_ERROR', message: 'Chỉ hỗ trợ file CSV hoặc XLSX.' } },
      })
    }

    const { rows, parseError } = buildRowsFromMatrix(matrix)
    return { data: rows, meta: { parseError } }
  }
  catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[parse-import] error:', detail)
    throw createError({
      statusCode: 422,
      data: { error: { code: 'VALIDATION_ERROR', message: `Không thể đọc file: ${detail}` } },
    })
  }
})
