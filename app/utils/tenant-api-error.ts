import { getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from './api-error'

interface TenantErrorDetails {
  fieldErrors?: Record<string, string[]>
  retryAfterSeconds?: number
}

/** Keep identity conflicts in the existing banner/field channels without exposing match details. */
export function getTenantApiError(error: unknown, fallback?: string): { message: string; fieldErrors: Record<string, string[]> } {
  const code = getApiErrorCode(error)
  const details = getApiErrorDetails<TenantErrorDetails>(error)
  if (code === 'TENANT_IDENTITY_CONFLICT') {
    return { message: 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên', fieldErrors: {} }
  }
  if (code === 'RATE_LIMITED') {
    const seconds = details?.retryAfterSeconds
    const wait = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
      ? ` Thử lại sau ${Math.ceil(seconds)} giây.`
      : ''
    return { message: `Bạn đã thử quá nhiều lần, vui lòng thử lại sau.${wait}`, fieldErrors: {} }
  }
  return { message: getApiErrorMessage(error, fallback), fieldErrors: details?.fieldErrors ?? {} }
}
