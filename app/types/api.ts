export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'

export type ApiSuccess<T> = {
  data: T
  meta?: Record<string, unknown>
}

export type ApiError = {
  error: {
    code: ErrorCode
    message: string
    details?: unknown
  }
}
