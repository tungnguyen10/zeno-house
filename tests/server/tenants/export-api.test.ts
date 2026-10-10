import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listCandidates: vi.fn(),
  buildWorkbook: vi.fn(),
  setXlsxResponse: vi.fn(),
  setHeader: vi.fn(),
}))

vi.mock('../../../server/services/tenants/export', () => ({ TenantExportService: mocks }))
vi.mock('../../../server/utils/excel', () => ({ setXlsxResponse: mocks.setXlsxResponse }))

const buildingId = '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b833333'
const tenantId = '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b844444'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('defineEventHandler', (handler: (event: unknown) => unknown) => handler)
  vi.stubGlobal('requireAuth', vi.fn(async () => ({ id: 'admin', app_metadata: { role: 'admin' } })))
  vi.stubGlobal('getQuery', (event: { query?: Record<string, unknown> }) => event.query ?? {})
  vi.stubGlobal('readBody', async (event: { body?: unknown }) => event.body)
  vi.stubGlobal('setHeader', mocks.setHeader)
})

describe('tenant export routes', () => {
  it('validates building and returns only candidate data', async () => {
    mocks.listCandidates.mockResolvedValue([{ id: tenantId, fullName: 'Nguyễn Văn A' }])
    const { default: handler } = await import('../../../server/api/tenants/export-candidates.get')
    const result = await handler({ query: { building_id: buildingId } } as never)
    expect(result).toEqual({ data: [{ id: tenantId, fullName: 'Nguyễn Văn A' }] })
    expect(mocks.listCandidates).toHaveBeenCalledWith(expect.anything(), expect.anything(), buildingId)
    expect(mocks.setHeader).toHaveBeenCalledWith(expect.anything(), 'Cache-Control', 'no-store')
    await expect(handler({ query: {} } as never)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('rejects empty selection and sends an xlsx response for a valid export', async () => {
    const { default: handler } = await import('../../../server/api/tenants/export.post')
    await expect(handler({ body: { building_id: buildingId, tenant_ids: [] } } as never)).rejects.toMatchObject({ statusCode: 422 })
    const buffer = Buffer.from('xlsx')
    mocks.buildWorkbook.mockResolvedValue({ buffer, fileName: 'tenants.xlsx' })
    const event = { body: { building_id: buildingId, tenant_ids: [tenantId] } }
    expect(await handler(event as never)).toBe(buffer)
    expect(mocks.setXlsxResponse).toHaveBeenCalledWith(event, buffer, 'tenants.xlsx')
  })
})
