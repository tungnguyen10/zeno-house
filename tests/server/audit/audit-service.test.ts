import { afterEach, describe, expect, it, vi } from 'vitest'

const auditRepository = vi.hoisted(() => ({
  append: vi.fn(),
  appendMany: vi.fn(),
}))

vi.mock('../../../server/repositories/audit', () => ({ AuditRepository: auditRepository }))

describe('AuditService error reporting', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('logs structured context in production without snapshots', async () => {
    auditRepository.append.mockRejectedValue(new Error('constraint violation'))
    vi.stubEnv('NODE_ENV', 'production')
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { AuditService } = await import('../../../server/services/audit')

    await expect(AuditService.append(
      { context: {} } as never,
      { id: 'actor-1' } as never,
      {
        building_id: 'building-1',
        action: 'tenant.updated',
        entity_type: 'tenant',
        entity_id: 'tenant-1',
        before_data: { password: 'secret-before' },
        after_data: { access_token: 'secret-after' },
      },
    )).resolves.toBeUndefined()

    expect(error).toHaveBeenCalledOnce()
    const [message, context] = error.mock.calls[0]!
    expect(message).toBe('[AuditService] append failed')
    expect(context).toEqual({
      action: 'tenant.updated',
      entityType: 'tenant',
      entityId: 'tenant-1',
      buildingId: 'building-1',
      errorType: 'Error',
      errorCode: null,
    })
    expect(JSON.stringify(context)).not.toContain('secret')
  })

  it('removes secrets, signed URLs, sessions and binary data before persistence', async () => {
    auditRepository.append.mockResolvedValue({ id: 'audit-1' })
    const { AuditService } = await import('../../../server/services/audit')

    await AuditService.append({ context: {} } as never, { id: 'actor-1' } as never, {
      building_id: null,
      action: 'tenant.updated',
      entity_type: 'tenant',
      before_data: {
        name: 'Tenant',
        password: 'secret',
        nested: {
          access_token: 'token',
          attachmentSignedUrl: 'https://signed.test/file?token=secret',
          download_url: 'https://storage.test/file?signature=secret',
        },
        session: { id: 'session-1' },
        data: Buffer.from('binary'),
      },
    })

    expect(auditRepository.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      before_data: { name: 'Tenant', nested: {} },
    }))
    expect(JSON.stringify(auditRepository.append.mock.calls[0])).not.toMatch(/secret|token|session-1|binary/)
  })
})
