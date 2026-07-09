import type { ErrorCode } from '~/types/api'

/**
 * Shape of errors thrown by `$fetch`/`useFetch` against our API. The standard envelope lives under
 * `data.error`, but Nuxt/H3 also expose top-level `message`/`statusMessage`/`statusCode`.
 */
export interface ApiErrorLike {
  data?: { error?: { code?: string; message?: string; details?: unknown } }
  message?: string
  statusMessage?: string
  statusCode?: number
}

/**
 * Extract a user-facing message from an API error. Reads only the standardized
 * envelope message (`data.error.message`); when absent, returns the provided
 * fallback rather than leaking a raw `FetchError`/`Error` message to the UI.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.'): string {
  const err = error as ApiErrorLike | null | undefined
  return err?.data?.error?.message ?? fallback
}

/**
 * Extract the standardized error code (e.g. `CONFLICT`, `VALIDATION_ERROR`) from an API error.
 */
export function getApiErrorCode(error: unknown): ErrorCode | undefined {
  const err = error as ApiErrorLike | null | undefined
  return err?.data?.error?.code as ErrorCode | undefined
}

/**
 * Extract the `details` payload from an API error (e.g. Zod `flatten()` output or conflict context).
 */
export function getApiErrorDetails<T = unknown>(error: unknown): T | undefined {
  const err = error as ApiErrorLike | null | undefined
  return err?.data?.error?.details as T | undefined
}
