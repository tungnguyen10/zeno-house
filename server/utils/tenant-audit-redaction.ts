export const TENANT_AUDIT_REDACTED = '[đã ẩn]'
export const TENANT_AUDIT_REDACTED_CHANGED = '[đã ẩn · đã thay đổi]'

const MASKED_KEYS = new Set(['idnumber'])
const HIDDEN_KEYS = new Set([
  'dateofbirth', 'permanentaddress', 'idissueddate', 'idissuedplace', 'emergencycontactname', 'emergencycontactphone',
])

type Snapshot = Record<string, unknown>
const keyOf = (key: string) => key.replace(/[^a-z0-9]/gi, '').toLowerCase()
const isSnapshot = (value: unknown): value is Snapshot => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const mask = (value: string) => `•••• ${value.slice(-4)}`

function redact(snapshot: Snapshot, previous: Snapshot | null): Snapshot {
  const output: Snapshot = { ...snapshot }
  for (const [key, value] of Object.entries(snapshot)) {
    const normalized = keyOf(key)
    if (value === null || value === undefined || value === '') continue
    const changed = previous !== null && previous[key] !== value
    if (MASKED_KEYS.has(normalized) && typeof value === 'string') {
      const previousValue = previous?.[key]
      const sameMask = typeof previousValue === 'string' && mask(previousValue) === mask(value)
      output[key] = changed && sameMask ? `${mask(value)} · đã thay đổi` : mask(value)
    }
    else if (HIDDEN_KEYS.has(normalized)) {
      output[key] = changed ? TENANT_AUDIT_REDACTED_CHANGED : TENANT_AUDIT_REDACTED
    }
  }
  return output
}

export function redactTenantAuditData(before: unknown, after: unknown): { before: unknown; after: unknown } {
  const previous = isSnapshot(before) ? before : null
  return {
    before: previous ? redact(previous, null) : before,
    after: isSnapshot(after) ? redact(after, previous) : after,
  }
}
