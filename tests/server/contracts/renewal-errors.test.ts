import { describe, expect, it, vi } from 'vitest'
import { throwDbError } from '../../../server/utils/errors'

const cases = [
  ['CONTRACT_NOT_FOUND', 404, 'NOT_FOUND', 'Không tìm thấy hợp đồng'],
  ['CONTRACT_NOT_ACTIVE', 409, 'CONFLICT', 'Chỉ gia hạn được hợp đồng đang hiệu lực'],
  ['CONTRACT_CHECKOUT_IN_PROGRESS', 409, 'CONFLICT', 'Hợp đồng đang làm thủ tục trả phòng'],
  ['CONTRACT_ALREADY_RENEWED', 409, 'CONFLICT', 'Hợp đồng đã được gia hạn'],
  ['RENEWAL_OPERATION_MISMATCH', 409, 'CONFLICT', 'Yêu cầu gia hạn bị trùng với một thao tác khác'],
  ['RENEWAL_OCCUPANTS_MISSING', 409, 'CONFLICT', 'Hợp đồng không có người ở hợp lệ để chuyển'],
  ['RENEWAL_END_DATE_INVALID', 422, 'VALIDATION_ERROR', 'Ngày kết thúc mới không hợp lệ'],
  ['CONTRACT_RENEWED_RECEIPT_LOCKED', 409, 'CONFLICT', 'Hợp đồng đã gia hạn, không thể thay đổi khoản thu'],
] as const

describe('renewal database error mapping', () => {
  it.each(cases)('maps %s', (reason, statusCode, code, message) => {
    expect(() => throwDbError({ message: reason }, 'test')).toThrow()
    try { throwDbError({ message: reason }, 'test') }
    catch (error) {
      expect(error).toMatchObject({ statusCode, data: { error: { code, message, ...(statusCode === 409 ? { details: { reason } } : {}) } } })
    }
  })

  it.each(['successor', 'active_per_room'])('maps duplicate contracts_one_%s', (constraint) => {
    expect(() => throwDbError({ code: '23505', message: `duplicate key value violates unique constraint "contracts_one_${constraint}"` })).toThrow(expect.objectContaining({
      statusCode: 409, data: { error: { code: 'CONFLICT', message: 'Hợp đồng đã được gia hạn', details: { reason: 'CONTRACT_ALREADY_RENEWED' } } },
    }))
  })

  it('maps concurrent operation ID uniqueness to a sanitized renewal mismatch', () => {
    const databaseError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "contract_renewals_operation_id_key"',
      details: 'Key (operation_id)=(private-operation-id) already exists.',
      hint: 'private database diagnostic',
    }
    expect(() => throwDbError(databaseError)).toThrow(expect.objectContaining({
      statusCode: 409,
      data: { error: {
        code: 'CONFLICT', message: 'Yêu cầu gia hạn bị trùng với một thao tác khác',
        details: { reason: 'RENEWAL_OPERATION_MISMATCH' },
      } },
    }))
  })

  it.each([
    { code: '23505', constraint: 'contract_renewals_operation_id_key_extra' },
    { code: '23514', constraint: 'contract_renewals_operation_id_key' },
    { code: '23505', constraint: 'unrelated_unique_constraint' },
  ])('keeps unrelated constraint failures internal ($code / $constraint)', ({ code, constraint }) => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => throwDbError({ code, message: `duplicate key value violates unique constraint "${constraint}"`, details: 'private database diagnostic' })).toThrow(expect.objectContaining({
        statusCode: 500,
        data: { error: { code: 'INTERNAL', message: 'Lỗi hệ thống, vui lòng thử lại.', details: undefined } },
      }))
    }
    finally { logger.mockRestore() }
  })

  it('preserves existing checkout guard conflicts', () => {
    expect(() => throwDbError({ message: 'CHECKOUT_X' })).toThrow(expect.objectContaining({ statusCode: 409, data: { error: expect.objectContaining({ details: { reason: 'CHECKOUT_X' } }) } }))
  })

  it('keeps unknown errors internal without leaking database messages', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => throwDbError({ message: 'RENEWAL_UNKNOWN secret' })).toThrow(expect.objectContaining({ statusCode: 500, data: { error: expect.objectContaining({ code: 'INTERNAL', message: 'Lỗi hệ thống, vui lòng thử lại.' }) } }))
    vi.restoreAllMocks()
  })
})
