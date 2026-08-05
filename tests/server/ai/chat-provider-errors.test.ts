import { describe, expect, it } from 'vitest'
import { normalizeProviderError } from '../../../server/services/ai/chat'

describe('AI chat provider error normalization', () => {
  it('maps provider authentication failures to PROVIDER_AUTH', () => {
    expect(normalizeProviderError({ statusCode: 401, message: 'Unauthorized' })).toEqual({
      type: 'error',
      error: {
        code: 'PROVIDER_AUTH',
        message: 'Không thể xác thực với nhà cung cấp AI. Vui lòng kiểm tra cấu hình khoá API.',
      },
    })
  })

  it('maps invalid model requests from responseBody to REQUEST_INVALID', () => {
    expect(normalizeProviderError({
      statusCode: 400,
      responseBody: JSON.stringify({
        error: {
          code: 'model_not_found',
          message: 'Model not found',
        },
      }),
    })).toEqual({
      type: 'error',
      error: {
        code: 'REQUEST_INVALID',
        message: 'Yêu cầu AI không hợp lệ với mô hình hiện tại. Vui lòng thử lại hoặc liên hệ quản trị viên.',
      },
    })
  })

  it('maps timeout style failures to PROVIDER_TIMEOUT', () => {
    expect(normalizeProviderError(new Error('Request timed out while waiting for provider'))).toEqual({
      type: 'error',
      error: {
        code: 'PROVIDER_TIMEOUT',
        message: 'Nhà cung cấp AI phản hồi quá chậm. Vui lòng thử lại sau ít phút.',
      },
    })
  })

  it('keeps existing provider capacity classification', () => {
    expect(normalizeProviderError('No available provider')).toEqual({
      type: 'error',
      error: {
        code: 'PROVIDER_CAPACITY',
        message: 'AI đang hết dung lượng miễn phí. Vui lòng thử lại sau.',
      },
    })
  })

  it('falls back to INTERNAL for unknown failures', () => {
    expect(normalizeProviderError({ foo: 'bar' })).toEqual({
      type: 'error',
      error: {
        code: 'INTERNAL',
        message: 'Không thể hoàn tất phản hồi AI. Vui lòng thử lại.',
      },
    })
  })
})
