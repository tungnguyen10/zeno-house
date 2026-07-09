import { describe, expect, it } from 'vitest'
import { getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'

describe('getApiErrorMessage', () => {
  it('prefers the envelope message', () => {
    const err = { data: { error: { message: 'Từ envelope' } }, message: 'H3' }
    expect(getApiErrorMessage(err)).toBe('Từ envelope')
  })

  it('returns the fallback and does not leak raw error/status messages', () => {
    expect(getApiErrorMessage({ message: 'H3 msg' }, 'Mặc định')).toBe('Mặc định')
    expect(getApiErrorMessage({ statusMessage: 'Status msg' }, 'Mặc định')).toBe('Mặc định')
    expect(getApiErrorMessage(null, 'Mặc định')).toBe('Mặc định')
  })

  it('uses the default fallback when nothing matches', () => {
    expect(getApiErrorMessage(undefined)).toBe('Đã xảy ra lỗi. Vui lòng thử lại.')
  })
})

describe('getApiErrorCode', () => {
  it('reads the standardized error code', () => {
    expect(getApiErrorCode({ data: { error: { code: 'CONFLICT' } } })).toBe('CONFLICT')
  })

  it('returns undefined when absent', () => {
    expect(getApiErrorCode({ message: 'x' })).toBeUndefined()
    expect(getApiErrorCode(null)).toBeUndefined()
  })
})

describe('getApiErrorDetails', () => {
  it('reads the details payload', () => {
    const err = { data: { error: { details: { fieldErrors: { name: ['bắt buộc'] } } } } }
    expect(getApiErrorDetails<{ fieldErrors: Record<string, string[]> }>(err)).toEqual({
      fieldErrors: { name: ['bắt buộc'] },
    })
  })

  it('returns undefined when absent', () => {
    expect(getApiErrorDetails({ message: 'x' })).toBeUndefined()
  })
})
