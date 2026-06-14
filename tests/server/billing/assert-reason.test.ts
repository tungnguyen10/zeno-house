describe('assertReason', () => {
  it('returns trimmed reason when length >= minLength', async () => {
    const { assertReason } = await import('../../../server/utils/billing/reason')
    expect(assertReason('  Sai chỉ số gốc cần điều chỉnh  ')).toBe('Sai chỉ số gốc cần điều chỉnh')
  })

  it('throws VALIDATION_ERROR when reason is missing', async () => {
    const { assertReason } = await import('../../../server/utils/billing/reason')
    expect(() => assertReason(undefined)).toThrowError(/Cần nhập lý do/)
  })

  it('throws VALIDATION_ERROR when reason is shorter than minLength', async () => {
    const { assertReason } = await import('../../../server/utils/billing/reason')
    let captured: { statusCode?: number; data?: unknown } | null = null
    try {
      assertReason('quá ngắn')
    }
    catch (err) {
      captured = err as { statusCode?: number; data?: unknown }
    }
    expect(captured?.statusCode).toBe(422)
    expect(captured?.data).toMatchObject({
      error: { code: 'VALIDATION_ERROR', details: { minLength: 10 } },
    })
  })

  it('throws VALIDATION_ERROR when only whitespace is supplied', async () => {
    const { assertReason } = await import('../../../server/utils/billing/reason')
    expect(() => assertReason('   ')).toThrowError(/ít nhất 10 ký tự/)
  })

  it('respects custom minLength', async () => {
    const { assertReason } = await import('../../../server/utils/billing/reason')
    expect(assertReason('hello', 3)).toBe('hello')
    expect(() => assertReason('hi', 3)).toThrowError(/ít nhất 3 ký tự/)
  })
})
