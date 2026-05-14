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
