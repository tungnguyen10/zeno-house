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

const RENEWAL_ERRORS: Record<string, { status: number, message: string }> = {
  CONTRACT_NOT_FOUND: { status: 404, message: 'Không tìm thấy hợp đồng' },
  CONTRACT_NOT_ACTIVE: { status: 409, message: 'Chỉ gia hạn được hợp đồng đang hiệu lực' },
  CONTRACT_CHECKOUT_IN_PROGRESS: { status: 409, message: 'Hợp đồng đang làm thủ tục trả phòng' },
  CONTRACT_ALREADY_RENEWED: { status: 409, message: 'Hợp đồng đã được gia hạn' },
  RENEWAL_OPERATION_MISMATCH: { status: 409, message: 'Yêu cầu gia hạn bị trùng với một thao tác khác' },
  RENEWAL_OCCUPANTS_MISSING: { status: 409, message: 'Hợp đồng không có người ở hợp lệ để chuyển' },
  RENEWAL_END_DATE_INVALID: { status: 422, message: 'Ngày kết thúc mới không hợp lệ' },
  CONTRACT_RENEWED_RECEIPT_LOCKED: { status: 409, message: 'Hợp đồng đã gia hạn, không thể thay đổi khoản thu' },
}

const BILLING_CLOSE_ERRORS: Record<string, { status: number, message: string }> = {
  PERIOD_NOT_FOUND: { status: 404, message: 'Không tìm thấy kỳ vận hành' },
  PERIOD_STATUS_INVALID: { status: 409, message: 'Chỉ có thể chốt kỳ đã phát hành hoặc đang thu' },
  PERIOD_HAS_OUTSTANDING: { status: 409, message: 'Còn hoá đơn chưa thanh toán đủ. Cần xử lý trước khi chốt kỳ.' },
  PERIOD_SNAPSHOT_STALE: { status: 409, message: 'Dữ liệu kỳ vừa thay đổi, vui lòng thử lại' },
  PERIOD_CLOSED_INCONSISTENT: { status: 409, message: 'Kỳ đã chốt nhưng thiếu dữ liệu chốt; cần kiểm tra đối soát' },
  PERIOD_NOT_CLOSED: { status: 409, message: 'Kỳ chưa chốt' },
  PERIOD_REOPEN_REASON_INVALID: { status: 422, message: 'Lý do mở lại phải có ít nhất 10 ký tự' },
  PERIOD_CLOSED_LOCKED: { status: 409, message: 'Kỳ đã chốt, không thể thay đổi hoá đơn hoặc thanh toán' },
}

function outstandingCount(details: unknown): number | null {
  if (typeof details !== 'string') return null
  try {
    const count = Number((JSON.parse(details) as { outstanding_count?: unknown }).outstanding_count)
    return Number.isInteger(count) && count > 0 ? count : null
  }
  catch {
    return null
  }
}

/**
 * Normalize known database domain guards, otherwise return the standard `INTERNAL` envelope.
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
    const message = String(error.message)
    let renewalReason = message.match(/^(CONTRACT|RENEWAL)_[A-Z_]+$/)?.[0]
    if ('code' in error && error.code === '23505') {
      if (/"contract_renewals_operation_id_key"/.test(message)) renewalReason = 'RENEWAL_OPERATION_MISMATCH'
      else if (/contracts_one_(active_per_room|successor)/.test(message)) renewalReason = 'CONTRACT_ALREADY_RENEWED'
    }
    const renewalError = renewalReason ? RENEWAL_ERRORS[renewalReason] : undefined
    if (renewalError) {
      if (renewalError.status === 404) throwNotFound(renewalError.message)
      if (renewalError.status === 422) throwValidationError(renewalError.message)
      throwConflict(renewalError.message, { reason: renewalReason })
    }
    const billingReason = message.match(/^PERIOD_[A-Z_]+$/)?.[0]
    const billingError = billingReason ? BILLING_CLOSE_ERRORS[billingReason] : undefined
    if (billingError) {
      if (billingError.status === 404) throwNotFound(billingError.message)
      if (billingError.status === 422) throwValidationError(billingError.message)
      const count = billingReason === 'PERIOD_HAS_OUTSTANDING'
        ? outstandingCount('details' in error ? error.details : undefined)
        : null
      throwConflict(
        count ? `Còn ${count} hoá đơn chưa thanh toán đủ. Cần xử lý trước khi chốt kỳ.` : billingError.message,
        { reason: billingReason },
      )
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
