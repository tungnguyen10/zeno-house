export function throwForbidden(message = 'Không có quyền thực hiện thao tác này'): never {
  throw createError({
    statusCode: 403,
    data: { error: { code: 'FORBIDDEN', message } },
  })
}

export function throwNotFound(message = 'Không tìm thấy'): never {
  throw createError({
    statusCode: 404,
    data: { error: { code: 'NOT_FOUND', message } },
  })
}

export function throwValidationError(message = 'Dữ liệu không hợp lệ', details?: unknown): never {
  throw createError({
    statusCode: 422,
    data: { error: { code: 'VALIDATION_ERROR', message, details } },
  })
}

export function throwConflict(message = 'Xung đột dữ liệu', details?: unknown): never {
  throw createError({
    statusCode: 409,
    data: { error: { code: 'CONFLICT', message, details } },
  })
}

/**
 * Normalize a Supabase/Postgres error into the standard `INTERNAL` envelope.
 *
 * Repositories must use this instead of `createError({ statusCode: 500, message: error.message })`
 * so raw database messages never leak to the client. Delegates to `throwInternal`, which logs the
 * original error with context and returns a generic user-facing message.
 */
export function throwDbError(error: unknown, context?: string): never {
  // Database guards also protect legacy write paths after checkout is enabled.
  // Expose only the stable domain code, never PostgreSQL query/details text.
  if (error && typeof error === 'object' && 'message' in error) {
    const reason = String(error.message).match(/^CHECKOUT_[A-Z_]+$/)?.[0]
    if (reason) {
      throwConflict('Dữ liệu đã được liên kết với hồ sơ trả phòng. Mở Trả phòng & tất toán để kiểm tra hoặc điều chỉnh.', { reason })
    }
  }
  throwInternal(error, context)
}

export function throwInternal(originalError: unknown, context?: string): never {
  const fields: Record<string, unknown> = {}
  if (originalError instanceof Error) {
    fields.message = originalError.message
  }
  if (originalError && typeof originalError === 'object') {
    const obj = originalError as Record<string, unknown>
    for (const key of ['message', 'code', 'details', 'hint'] as const) {
      if (key in obj && obj[key] !== undefined) fields[key] = obj[key]
    }
  }
  console.error('[INTERNAL]', context ?? '(no context)', fields, originalError)

  throw createError({
    statusCode: 500,
    data: {
      error: {
        code: 'INTERNAL',
        message: 'Lỗi hệ thống, vui lòng thử lại.',
        details: context ? { context } : undefined,
      },
    },
  })
}
