import type { ApiSuccess } from '~/types/api'
import type { Tenant } from '~/types/tenants'
import { tenantCreateSchema, type TenantBulkCreateRowInput } from '~/utils/validators/tenants'
import { getApiErrorMessage } from '~/utils/api-error'

export interface TenantBulkCreateFailure {
  line: number
  reason: 'validation_error' | 'duplicate_in_file' | 'duplicate_id_number' | 'duplicate_phone_in_file' | 'duplicate_phone' | 'unexpected_error'
  message: string
  fieldErrors?: Record<string, string[]>
}

export interface TenantBulkCreateResult {
  created: Tenant[]
  failed: TenantBulkCreateFailure[]
}

export interface TenantBulkPreviewRow extends TenantBulkCreateRowInput {
  issues: string[]
  fieldErrors: Record<string, string[]>
}



function normalizeCell(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function normalizePreviewRow(row: TenantBulkCreateRowInput) {
  const gender = normalizeCell(row.gender)
  return {
    full_name: normalizeCell(row.full_name) ?? '',
    phone: normalizeCell(row.phone) ?? '',
    email: normalizeCell(row.email),
    id_number: normalizeCell(row.id_number),
    date_of_birth: normalizeCell(row.date_of_birth),
    permanent_address: normalizeCell(row.permanent_address),
    notes: normalizeCell(row.notes),
    gender,
    occupation: normalizeCell(row.occupation),
    id_issued_date: normalizeCell(row.id_issued_date),
    id_issued_place: normalizeCell(row.id_issued_place),
    emergency_contact_name: normalizeCell(row.emergency_contact_name),
    emergency_contact_phone: normalizeCell(row.emergency_contact_phone),
  }
}

export function useTenantBulkCreate() {
  const fileName = ref<string | null>(null)
  const rows = ref<TenantBulkCreateRowInput[]>([])
  const parseError = ref<string | null>(null)
  const submitError = ref<string | null>(null)
  const isParsing = ref(false)
  const isSubmitting = ref(false)

  const previewRows = computed<TenantBulkPreviewRow[]>(() => {
    const duplicateIdNumbers = new Set<string>()
    const seenIdNumbers = new Set<string>()
    const duplicatePhones = new Set<string>()
    const seenPhones = new Set<string>()

    for (const row of rows.value) {
      const id = normalizeCell(row.id_number)
      if (id) {
        if (seenIdNumbers.has(id)) duplicateIdNumbers.add(id)
        else seenIdNumbers.add(id)
      }

      const phone = normalizeCell(row.phone)
      if (phone) {
        if (seenPhones.has(phone)) duplicatePhones.add(phone)
        else seenPhones.add(phone)
      }
    }

    return rows.value.map((row) => {
      const normalized = normalizePreviewRow(row)
      const validation = tenantCreateSchema.safeParse(normalized)
      const fieldErrors = validation.success ? {} : validation.error.flatten().fieldErrors
      if (normalized.id_number && duplicateIdNumbers.has(normalized.id_number)) {
        const existing = fieldErrors.id_number ?? []
        fieldErrors.id_number = [...existing, 'Số CMND/CCCD bị trùng trong file nhập']
      }
      if (normalized.phone && duplicatePhones.has(normalized.phone)) {
        const existing = fieldErrors.phone ?? []
        fieldErrors.phone = [...existing, 'Số điện thoại bị trùng trong file nhập']
      }

      const issues = Object.entries(fieldErrors)
        .flatMap(([field, messages]) => (messages ?? []).map(message => `${field}: ${message}`))

      return {
        ...row,
        issues,
        fieldErrors,
      }
    })
  })

  const totalRows = computed(() => previewRows.value.length)
  const validRows = computed(() => previewRows.value.filter(row => row.issues.length === 0).length)
  const invalidRows = computed(() => totalRows.value - validRows.value)

  const canSubmit = computed(() =>
    rows.value.length > 0
    && validRows.value > 0
    && !isSubmitting.value
    && !isParsing.value,
  )

  async function parseFile(file: File) {
    fileName.value = file.name
    parseError.value = null
    submitError.value = null
    rows.value = []
    isParsing.value = true

    try {
      const lower = file.name.toLowerCase()
      let content: string

      if (lower.endsWith('.csv')) {
        content = await file.text()
      }
      else if (lower.endsWith('.xlsx')) {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]!)
        }
        content = btoa(binary)
      }
      else {
        parseError.value = 'Chỉ hỗ trợ file CSV hoặc XLSX.'
        return
      }

      const response = await $fetch<{ data: TenantBulkCreateRowInput[]; meta: { parseError: string | null } }>(
        '/api/tenants/parse-import',
        { method: 'POST', body: { filename: file.name, content } },
      )

      rows.value = response.data
      parseError.value = response.meta?.parseError ?? null
    }
    catch (error: unknown) {
      parseError.value = getApiErrorMessage(error, 'Không thể đọc file. Vui lòng kiểm tra định dạng CSV/XLSX.')
    }
    finally {
      isParsing.value = false
    }
  }

  async function submit(): Promise<TenantBulkCreateResult | null> {
    submitError.value = null
    if (!canSubmit.value) return null

    isSubmitting.value = true
    try {
      const response = await $fetch<ApiSuccess<TenantBulkCreateResult>>('/api/tenants/bulk-create', {
        method: 'POST',
        body: { rows: rows.value },
      })
      return response.data
    }
    catch (error: unknown) {
      submitError.value = getApiErrorMessage(error, 'Không thể nhập danh sách khách thuê.')
      return null
    }
    finally {
      isSubmitting.value = false
    }
  }

  function reset() {
    fileName.value = null
    rows.value = []
    parseError.value = null
    submitError.value = null
    isParsing.value = false
    isSubmitting.value = false
  }

  return {
    fileName,
    rows,
    previewRows,
    parseError,
    submitError,
    isParsing,
    isSubmitting,
    totalRows,
    validRows,
    invalidRows,
    canSubmit,
    parseFile,
    submit,
    reset,
  }
}
