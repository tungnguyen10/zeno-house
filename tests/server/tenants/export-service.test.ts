import ExcelJS from 'exceljs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import type { Tenant } from '~/types/tenants'

const mocks = vi.hoisted(() => ({
  findBuilding: vi.fn(),
  visibleBuildings: vi.fn(),
  listAssignments: vi.fn(),
  findTenants: vi.fn(),
  appendAudit: vi.fn(),
}))

vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: { findByIdentifier: mocks.findBuilding } }))
vi.mock('../../../server/repositories/tenants/export', () => ({
  TenantExportRepository: { listCurrentAssignments: mocks.listAssignments, findTenants: mocks.findTenants },
}))
vi.mock('../../../server/utils/scope', () => ({ getVisibleBuildingIds: mocks.visibleBuildings }))
vi.mock('../../../server/repositories/audit', () => ({ AuditRepository: { append: mocks.appendAudit } }))

const buildingId = '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b833333'
const tenantId = '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b844444'
const admin = { id: 'admin', app_metadata: { role: 'admin' } } as AuthUser
const owner = { id: 'owner', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'manager', app_metadata: { role: 'manager' } } as AuthUser

const tenant = {
  id: tenantId,
  code: 'nva-2026-0001',
  fullName: 'Nguyễn Văn A',
  phone: '0901234567',
  email: '[email protected]',
  idNumber: '012345678901',
  dateOfBirth: '1990-01-02',
  gender: 'male',
  occupation: 'Giáo viên',
  idIssuedDate: '2020-01-01',
  idIssuedPlace: 'Hà Nội',
  permanentAddress: 'Số 1 Đường A',
  emergencyContactName: 'Nguyễn Thị B',
  emergencyContactPhone: '0987654321',
  notes: 'Ghi chú',
  status: 'active',
  idCardFrontPath: 'secret/front.jpg',
  idCardBackPath: 'secret/back.jpg',
  idCardFrontSignedUrl: 'https://secret/front',
  idCardBackSignedUrl: 'https://secret/back',
} as Tenant

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findBuilding.mockResolvedValue({ id: buildingId, name: 'Tòa Ánh Dương' })
  mocks.visibleBuildings.mockResolvedValue([buildingId])
  mocks.listAssignments.mockResolvedValue([{ tenantId, roomNumbers: ['101'], roles: ['primary'] }])
  mocks.findTenants.mockResolvedValue([tenant])
})

describe('TenantExportService', () => {
  it('denies managers before querying private tenant data', async () => {
    const { TenantExportService } = await import('../../../server/services/tenants/export')
    await expect(TenantExportService.listCandidates({} as never, manager, buildingId)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.findTenants).not.toHaveBeenCalled()
  })

  it('limits owners to visible assigned buildings', async () => {
    mocks.visibleBuildings.mockResolvedValue([])
    const { TenantExportService } = await import('../../../server/services/tenants/export')
    await expect(TenantExportService.listCandidates({} as never, owner, buildingId)).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.listAssignments).not.toHaveBeenCalled()
  })

  it('rejects a stale selected tenant instead of returning a partial file', async () => {
    const { TenantExportService } = await import('../../../server/services/tenants/export')
    await expect(TenantExportService.buildWorkbook({} as never, admin, {
      building_id: buildingId,
      tenant_ids: [tenantId, '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b855555'],
    })).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.findTenants).not.toHaveBeenCalled()
  })

  it('exports full text profile as one row and keeps phone and ID as text', async () => {
    const { TenantExportService } = await import('../../../server/services/tenants/export')
    const result = await TenantExportService.buildWorkbook({} as never, owner, {
      building_id: buildingId,
      tenant_ids: [tenantId],
    })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(result.buffer)
    const sheet = workbook.worksheets[0]!
    const values = sheet.getRow(4).values as unknown[]
    expect(sheet.getCell('A1').value).toBe('DANH SÁCH KHÁCH THUÊ')
    expect(sheet.getCell('A3').value).toBe('Mã khách')
    expect(sheet.rowCount).toBe(4)
    expect(values).toContain('Nguyễn Văn A')
    expect(values).toContain('0901234567')
    expect(values).toContain('012345678901')
    expect(values).toContain('Giáo viên')
    expect(values).not.toContain('secret/front.jpg')
    expect(sheet.getCell('C4').type).toBe(ExcelJS.ValueType.String)
    expect(sheet.getCell('H4').type).toBe(ExcelJS.ValueType.String)
    expect(result.fileName).toMatch(/^tenants-toa-anh-duong-\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(mocks.appendAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'tenant.exported',
      building_id: buildingId,
      actor_id: owner.id,
      metadata: { tenant_count: 1, tenant_ids: [tenantId], format: 'xlsx' },
    }))
  })

  it('does not release a private workbook when the audit write fails', async () => {
    mocks.appendAudit.mockRejectedValue(new Error('audit unavailable'))
    const { TenantExportService } = await import('../../../server/services/tenants/export')
    await expect(TenantExportService.buildWorkbook({} as never, admin, {
      building_id: buildingId, tenant_ids: [tenantId],
    })).rejects.toThrow('audit unavailable')
  })
})
