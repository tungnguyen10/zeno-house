import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useExportDownload } from '../../app/composables/useExportDownload'

const raw = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', { raw })

beforeEach(() => vi.clearAllMocks())

describe('useExportDownload', () => {
  it('surfaces a JSON API error returned as a blob', async () => {
    raw.mockRejectedValue({ data: new Blob([JSON.stringify({ error: {
      code: 'CONFLICT', message: 'Vui lòng chọn lại khách cần xuất.',
      details: { reason: 'TENANT_EXPORT_SELECTION_STALE' },
    } })], { type: 'application/json' }) })

    await expect(useExportDownload().downloadBlob('/api/tenants/export', 'tenants.xlsx'))
      .rejects.toMatchObject({ data: { error: { code: 'CONFLICT', details: { reason: 'TENANT_EXPORT_SELECTION_STALE' } } } })
  })
})
