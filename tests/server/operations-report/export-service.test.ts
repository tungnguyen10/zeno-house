import ExcelJS from 'exceljs'
import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import type { OperationsReport } from '~/types/operations-report'

const findBuildingById = vi.fn()
const getReport = vi.fn()
const assertBuildingScope = vi.fn()
const canMock = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findById: findBuildingById },
}))

vi.mock('../../../server/services/operations-report/report', () => ({
  OperationsReportService: { getReport },
}))

vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope,
}))

const admin = { id: 'admin-1', app_metadata: { role: 'admin' } } as AuthUser
const manager = { id: 'manager-1', app_metadata: { role: 'manager' } } as AuthUser

const report: OperationsReport = {
  buildingId: 'building-1',
  periodYear: 2026,
  periodMonth: 6,
  metrics: {
    issuedRevenue: 5_000_000,
    collectedCash: 4_000_000,
    debt: 1_000_000,
    fixedCostTotal: 10_000_000,
    monthlyExpenseTotal: 1_500_000,
    prepaidAllocationTotal: 250_000,
    totalExpense: 11_750_000,
    profitByRevenue: -6_750_000,
    profitByCash: -7_750_000,
  },
  revenueByType: [{ key: 'rent', label: 'Tiền phòng', amount: 5_000_000 }],
  expenseByCategory: [{ key: 'repair', label: 'Sửa chữa / bảo trì', amount: 1_500_000 }],
  fixedCostByCategory: [{ key: 'rent', label: 'Tiền thuê nhà', amount: 10_000_000 }],
  electricity: { collected: 1_000_000, input: 700_000, margin: 300_000 },
  water: { collected: 500_000, input: 300_000, margin: 200_000 },
  fixedCosts: [
    {
      id: 'fixed-1',
      buildingId: 'building-1',
      category: 'rent',
      amount: 10_000_000,
      effectiveFromPeriodYear: 2026,
      effectiveFromPeriodMonth: 1,
      effectiveToPeriodYear: null,
      effectiveToPeriodMonth: null,
      note: null,
      createdBy: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  expenses: [
    {
      id: 'expense-1',
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 6,
      expenseDate: '2026-06-15',
      category: 'repair',
      amount: 1_500_000,
      payee: 'Vendor',
      paymentMethod: null,
      note: null,
      receiptUrl: null,
      receiptSignedUrl: null,
      createdBy: null,
      voidedAt: null,
      voidedBy: null,
      voidReason: null,
      createdAt: '2026-06-15T00:00:00Z',
      updatedAt: '2026-06-15T00:00:00Z',
    },
  ],
  prepaidItems: [
    {
      id: 'prepaid-1',
      name: 'Internet năm',
      category: 'internet',
      monthlyAmount: 250_000,
    },
  ],
}

describe('OperationsReportExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', canMock)
    canMock.mockImplementation((user: AuthUser, capability: string) =>
      capability === 'operations-report.export'
        ? user.app_metadata.role === 'admin' || user.app_metadata.role === 'owner'
        : true,
    )
    findBuildingById.mockResolvedValue({ id: 'building-1', name: 'Nhà Mẫu' })
    assertBuildingScope.mockResolvedValue(undefined)
    getReport.mockResolvedValue(report)
  })

  it('requires export capability', async () => {
    const { OperationsReportExportService } = await import(
      '../../../server/services/operations-report/export'
    )

    await expect(
      OperationsReportExportService.buildWorkbook({} as never, manager, {
        building_id: 'building-1',
        period_year: 2026,
        period_month: 6,
      }),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(findBuildingById).not.toHaveBeenCalled()
    expect(getReport).not.toHaveBeenCalled()
  })

  it('enforces scope and returns a named workbook with report sections', async () => {
    const { OperationsReportExportService } = await import(
      '../../../server/services/operations-report/export'
    )

    const result = await OperationsReportExportService.buildWorkbook({} as never, admin, {
      building_id: 'building-1',
      period_year: 2026,
      period_month: 6,
    })

    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), admin, 'building-1', 'read')
    expect(result.fileName).toBe('bao-cao-van-hanh-nha-mau-2026-06.xlsx')
    expect(result.buffer.length).toBeGreaterThan(0)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(result.buffer)
    const sheet = workbook.getWorksheet('Báo cáo vận hành')
    expect(sheet).toBeDefined()
    expect(sheet?.getCell('A1').value).toBe('BÁO CÁO VẬN HÀNH 06/2026')
  })
})
