import { describe, expect, it, vi } from 'vitest'
import { throwConflict, throwDbError } from '../../../server/utils/errors'

describe('throwConflict', () => {
  it('throws a 409 CONFLICT envelope', () => {
    expect(() => throwConflict('Trùng dữ liệu')).toThrowError()
    try {
      throwConflict('Trùng dữ liệu')
    }
    catch (e) {
      expect(e).toMatchObject({
        statusCode: 409,
        data: { error: { code: 'CONFLICT', message: 'Trùng dữ liệu' } },
      })
    }
  })

  it('includes details when provided', () => {
    try {
      throwConflict('Xung đột', { activeContracts: 3 })
    }
    catch (e) {
      expect(e).toMatchObject({
        data: { error: { code: 'CONFLICT', details: { activeContracts: 3 } } },
      })
    }
  })
})

describe('throwDbError', () => {
  it('throws a generic 500 INTERNAL envelope without leaking the raw message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const raw = new Error('duplicate key value violates unique constraint "buildings_pkey"')

    try {
      throwDbError(raw, 'buildings.insert')
    }
    catch (e) {
      const err = e as { statusCode?: number; data?: { error?: { code?: string; message?: string } } }
      expect(err.statusCode).toBe(500)
      expect(err.data?.error?.code).toBe('INTERNAL')
      expect(err.data?.error?.message).not.toContain('duplicate key')
    }
  })

  it('logs the original error with context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      throwDbError(new Error('boom'), 'rooms.update')
    }
    catch {
      // ignore
    }
    expect(spy).toHaveBeenCalledWith('[INTERNAL]', 'rooms.update', expect.anything(), expect.anything())
  })
})
