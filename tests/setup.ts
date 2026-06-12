import { vi } from 'vitest'

function appError(statusCode: number, code: string, message: string, details?: unknown): Error {
  const error = new Error(message) as Error & { statusCode: number; data: unknown }
  error.statusCode = statusCode
  error.data = { error: { code, message, details } }
  return error
}

vi.stubGlobal('createError', (input: { statusCode?: number; message?: string; data?: unknown }) => {
  const error = new Error(input.message ?? 'Error') as Error & { statusCode?: number; data?: unknown }
  error.statusCode = input.statusCode
  error.data = input.data
  return error
})

vi.stubGlobal('throwConflict', (message = 'Conflict') => {
  throw appError(409, 'CONFLICT', message)
})

vi.stubGlobal('throwValidationError', (message = 'Validation error', details?: unknown) => {
  throw appError(422, 'VALIDATION_ERROR', message, details)
})

vi.stubGlobal('throwForbidden', (message = 'Forbidden') => {
  throw appError(403, 'FORBIDDEN', message)
})

vi.stubGlobal('throwNotFound', (message = 'Not found') => {
  throw appError(404, 'NOT_FOUND', message)
})

vi.stubGlobal('can', () => true)
