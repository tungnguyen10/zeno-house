import { describe, expect, it } from 'vitest'
import { throwDbError } from '../../../server/utils/errors'

function catchError(error: unknown) {
  try {
    throwDbError(error, 'test')
  }
  catch (thrown) {
    return thrown as { statusCode: number, data?: { error?: { code?: string, message?: string, details?: { reason?: string } } } }
  }
  throw new Error('throwDbError did not throw')
}

describe('throwDbError billing close codes', () => {
  it.each([
    ['PERIOD_NOT_FOUND', 404, 'NOT_FOUND', 'Không tìm thấy kỳ vận hành'],
    ['PERIOD_STATUS_INVALID', 409, 'CONFLICT', 'Chỉ có thể chốt kỳ đã phát hành hoặc đang thu'],
    ['PERIOD_SNAPSHOT_STALE', 409, 'CONFLICT', 'Dữ liệu kỳ vừa thay đổi, vui lòng thử lại'],
    ['PERIOD_CLOSED_INCONSISTENT', 409, 'CONFLICT', 'Kỳ đã chốt nhưng thiếu dữ liệu chốt; cần kiểm tra đối soát'],
    ['PERIOD_NOT_CLOSED', 409, 'CONFLICT', 'Kỳ chưa chốt'],
    ['PERIOD_REOPEN_REASON_INVALID', 422, 'VALIDATION_ERROR', 'Lý do mở lại phải có ít nhất 10 ký tự'],
    ['PERIOD_CLOSED_LOCKED', 409, 'CONFLICT', 'Kỳ đã chốt, không thể thay đổi hoá đơn hoặc thanh toán'],
  ])('maps %s', (code, statusCode, errorCode, message) => {
    const thrown = catchError({ message: code })
    expect(thrown.statusCode).toBe(statusCode)
    expect(thrown.data?.error?.code).toBe(errorCode)
    expect(thrown.data?.error?.message).toBe(message)
    if (statusCode === 409) expect(thrown.data?.error?.details?.reason).toBe(code)
  })

  it('interpolates the outstanding invoice count from the error details', () => {
    const thrown = catchError({ message: 'PERIOD_HAS_OUTSTANDING', details: '{"outstanding_count":3}' })
    expect(thrown.statusCode).toBe(409)
    expect(thrown.data?.error?.message).toBe('Còn 3 hoá đơn chưa thanh toán đủ. Cần xử lý trước khi chốt kỳ.')
    expect(thrown.data?.error?.details?.reason).toBe('PERIOD_HAS_OUTSTANDING')
  })

  it('falls back to a generic outstanding message when details are missing or malformed', () => {
    for (const details of [undefined, 'not json', '{"outstanding_count":"x"}']) {
      const thrown = catchError({ message: 'PERIOD_HAS_OUTSTANDING', details })
      expect(thrown.data?.error?.message).toBe('Còn hoá đơn chưa thanh toán đủ. Cần xử lý trước khi chốt kỳ.')
    }
  })

  it('keeps checkout and renewal codes working', () => {
    expect(catchError({ message: 'CHECKOUT_PERIOD_CLOSED' }).data?.error?.details?.reason).toBe('CHECKOUT_PERIOD_CLOSED')
    expect(catchError({ message: 'CONTRACT_NOT_FOUND' }).statusCode).toBe(404)
  })

  it('does not expose unknown PERIOD_ codes', () => {
    expect(catchError({ message: 'PERIOD_SOMETHING_ELSE' }).statusCode).toBe(500)
  })
})
