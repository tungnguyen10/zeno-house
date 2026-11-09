export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'TENANT_DUPLICATE'
  | 'TENANT_IDENTITY_CONFLICT'
  | 'RATE_LIMITED'
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
