/** Centralized validation messages shared across validators (client + server). */
export const VALIDATION_MESSAGES = {
  emailInvalid: 'Email không hợp lệ',
  deleteReasonRequired: 'Lý do xoá là bắt buộc',
  passwordMin: 'Mật khẩu tối thiểu 8 ký tự',
  passwordMax: 'Mật khẩu tối đa 72 ký tự',
} as const

/** Builds a "select at least one …" message for bulk selection schemas. */
export function selectAtLeastOne(entity: string): string {
  return `Cần chọn ít nhất một ${entity}`
}
