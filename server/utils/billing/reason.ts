/**
 * Shared validator for destructive billing actions. Every void / reissue /
 * unissue / override / large negative adjustment must carry a reason explaining
 * why the immutable record is being changed. Trimmed length is enforced at the
 * server boundary so audit metadata stays meaningful.
 */
export function assertReason(reason: unknown, minLength = 10): string {
  if (typeof reason !== 'string') {
    throwValidationError(`Cần nhập lý do (tối thiểu ${minLength} ký tự)`)
  }
  const trimmed = reason.trim()
  if (trimmed.length < minLength) {
    throwValidationError(`Lý do phải có ít nhất ${minLength} ký tự`, {
      reason: trimmed,
      minLength,
    })
  }
  return trimmed
}
