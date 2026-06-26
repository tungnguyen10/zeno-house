export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INTERNAL'

export type ApiSuccess<T, M extends Record<string, unknown> = Record<string, unknown>> = {
  data: T
  meta?: M
}

export type ApiError = {
  error: {
    code: ErrorCode
    message: string
    details?: unknown
  }
}
