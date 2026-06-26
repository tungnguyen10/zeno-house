import { describe, expect, it, vi, beforeEach } from 'vitest'
import { throwInternal } from '../../../server/utils/errors'

describe('throwInternal envelope', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('throws 500 with INTERNAL code and generic message', () => {
    try {
      throwInternal(new Error('secret db error'), 'dashboard.repository.rooms')
      throw new Error('should not reach')
    } catch (err) {
      const e = err as { statusCode?: number; data?: { error?: { code?: string; message?: string; details?: { context?: string } } } }
      expect(e.statusCode).toBe(500)
      expect(e.data?.error?.code).toBe('INTERNAL')
      expect(e.data?.error?.message).toBe('Lỗi hệ thống, vui lòng thử lại.')
      expect(e.data?.error?.details?.context).toBe('dashboard.repository.rooms')
    }
  })

  it('does not leak raw error message into response body', () => {
    try {
      throwInternal(new Error('SQL syntax error near table foo'))
      throw new Error('should not reach')
    } catch (err) {
      const e = err as { data?: { error?: { message?: string; details?: unknown } } }
      const body = JSON.stringify(e.data)
      expect(body).not.toContain('SQL syntax error near table foo')
      expect(e.data?.error?.message).toBe('Lỗi hệ thống, vui lòng thử lại.')
    }
  })

  it('omits details when no context is provided', () => {
    try {
      throwInternal(new Error('boom'))
      throw new Error('should not reach')
    } catch (err) {
      const e = err as { data?: { error?: { details?: unknown } } }
      expect(e.data?.error?.details).toBeUndefined()
    }
  })

  it('logs the original error server-side', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      throwInternal({ message: 'pg', code: '42P01', hint: 'check table', details: 'd' }, 'ctx')
    } catch {
      // expected
    }
    expect(spy).toHaveBeenCalled()
    const args = spy.mock.calls[0]
    expect(args[0]).toBe('[INTERNAL]')
    expect(args[1]).toBe('ctx')
    const fields = args[2] as Record<string, unknown>
    expect(fields.code).toBe('42P01')
    expect(fields.hint).toBe('check table')
  })
})
