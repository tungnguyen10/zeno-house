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

export function throwConflict(message = 'Xung đột dữ liệu'): never {
  throw createError({
    statusCode: 409,
    data: { error: { code: 'CONFLICT', message } },
  })
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
