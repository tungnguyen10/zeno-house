import type { H3Event } from 'h3'
import ExcelJS from 'exceljs'
import type { AuthUser } from '~/types/auth'
import type { OperationsReportQuery } from '~/utils/validators/operations-report'
import {
  EXPENSE_CATEGORY_LABELS,
  FIXED_COST_CATEGORY_LABELS,
} from '~/utils/constants/operations-report'
import { slugifyName } from '~/utils/format/slug'
import {
  MONEY_FORMAT,
  alignRightCells,
  styleTableRow,
  styleTitleRow,
  viExportDate,
} from '../../utils/excel'
import { BuildingRepository } from '../../repositories/buildings'
import { OperationsReportService } from './report'
import { assertBuildingScope } from '../../utils/scope'

const COL_COUNT = 5

function periodSlug(query: OperationsReportQuery): string {
  return `${query.period_year}-${String(query.period_month).padStart(2, '0')}`
}

function periodTitle(query: OperationsReportQuery): string {
  return `${String(query.period_month).padStart(2, '0')}/${query.period_year}`
}

function addSectionTitle(sheet: ExcelJS.Worksheet, title: string) {
  const row = sheet.addRow([title])
  sheet.mergeCells(row.number, 1, row.number, COL_COUNT)
  row.font = { bold: true, size: 14, name: 'Times New Roman' }
  row.alignment = { horizontal: 'left', vertical: 'middle' }
  row.height = 24
}

function addMoneyRow(sheet: ExcelJS.Worksheet, label: string, amount: number, note = '') {
  const row = sheet.addRow(['', label, amount, note, ''])
  row.getCell(3).numFmt = MONEY_FORMAT
  styleTableRow(row, false, COL_COUNT)
  alignRightCells(row, 3, 3)
}

export const OperationsReportExportService = {
  async buildWorkbook(
    event: H3Event,
    user: AuthUser,
    query: OperationsReportQuery,
  ): Promise<{ buffer: Buffer, fileName: string }> {
    if (!can(user, 'operations-report.export')) throwForbidden('Không có quyền xuất báo cáo vận hành')

    const building = await BuildingRepository.findById(event, query.building_id)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, user, query.building_id, 'read')

    const report = await OperationsReportService.getReport(event, user, query)

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Zeno House'
    wb.created = new Date()

    const sheet = wb.addWorksheet('Báo cáo vận hành')
    sheet.columns = [
      { key: 'index', width: 8 },
      { key: 'label', width: 34 },
      { key: 'amount', width: 18, style: { numFmt: MONEY_FORMAT } },
      { key: 'note', width: 34 },
      { key: 'extra', width: 18 },
    ]

    sheet.mergeCells('A1:E1')
    sheet.getCell('A1').value = `BÁO CÁO VẬN HÀNH ${periodTitle(query)}`
    styleTitleRow(sheet.getRow(1), 18)
    sheet.getRow(1).height = 34

    sheet.mergeCells('A2:E2')
    sheet.getCell('A2').value = building.name
    styleTitleRow(sheet.getRow(2), 16)
    sheet.getRow(2).height = 28

    const generatedRow = sheet.addRow(['', viExportDate(), '', '', ''])
    sheet.mergeCells(generatedRow.number, 1, generatedRow.number, COL_COUNT)
    generatedRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }

    addSectionTitle(sheet, 'Tổng quan')
    const overviewRows: Array<[string, number]> = [
      ['Doanh thu phát hành', report.metrics.issuedRevenue],
      ['Đã thu', report.metrics.collectedCash],
      ['Công nợ', report.metrics.debt],
      ['Tổng chi phí cố định', report.metrics.fixedCostTotal],
      ['Tổng chi phí tháng', report.metrics.monthlyExpenseTotal],
      ['Chi phí trả trước phân bổ', report.metrics.prepaidAllocationTotal],
      ['Tổng chi phí', report.metrics.totalExpense],
      ['Lợi nhuận theo doanh thu', report.metrics.profitByRevenue],
      ['Lợi nhuận theo tiền thu', report.metrics.profitByCash],
    ]
    overviewRows.forEach(([label, amount]) => addMoneyRow(sheet, label, amount))

    sheet.addRow([])
    addSectionTitle(sheet, 'Doanh thu theo loại')
    report.revenueByType.forEach(row => addMoneyRow(sheet, row.label, row.amount))

    sheet.addRow([])
    addSectionTitle(sheet, 'Chi phí cố định')
    report.fixedCosts.forEach((cost, index) => {
      const row = sheet.addRow([
        index + 1,
        FIXED_COST_CATEGORY_LABELS[cost.category] ?? cost.category,
        cost.amount,
        `Từ ${cost.effectiveFromPeriodMonth}/${cost.effectiveFromPeriodYear}`
        + (cost.effectiveToPeriodYear ? ` đến ${cost.effectiveToPeriodMonth}/${cost.effectiveToPeriodYear}` : ''),
        cost.note ?? '',
      ])
      row.getCell(3).numFmt = MONEY_FORMAT
      styleTableRow(row, false, COL_COUNT)
      alignRightCells(row, 3, 3)
    })

    sheet.addRow([])
    addSectionTitle(sheet, 'Chi phí phát sinh')
    report.expenses.forEach((expense, index) => {
      const row = sheet.addRow([
        index + 1,
        EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category,
        expense.amount,
        expense.expenseDate ?? '',
        [expense.payee, expense.paymentMethod, expense.note].filter(Boolean).join(' - '),
      ])
      row.getCell(3).numFmt = MONEY_FORMAT
      styleTableRow(row, false, COL_COUNT)
      alignRightCells(row, 3, 3)
    })

    sheet.addRow([])
    addSectionTitle(sheet, 'Chi phí trả trước (phân bổ)')
    report.prepaidItems.forEach((item, index) => {
      const row = sheet.addRow([
        index + 1,
        item.name,
        item.monthlyAmount,
        EXPENSE_CATEGORY_LABELS[item.category] ?? item.category,
        '',
      ])
      row.getCell(3).numFmt = MONEY_FORMAT
      styleTableRow(row, false, COL_COUNT)
      alignRightCells(row, 3, 3)
    })

    sheet.addRow([])
    addSectionTitle(sheet, 'Điện nước')
    addMoneyRow(sheet, 'Điện thu khách', report.electricity.collected)
    addMoneyRow(sheet, 'Điện đầu vào', report.electricity.input)
    addMoneyRow(sheet, 'Chênh lệch điện', report.electricity.margin)
    addMoneyRow(sheet, 'Nước thu khách', report.water.collected)
    addMoneyRow(sheet, 'Nước đầu vào', report.water.input)
    addMoneyRow(sheet, 'Chênh lệch nước', report.water.margin)

    const arrayBuffer = await wb.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer)
    const fileName = `bao-cao-van-hanh-${slugifyName(building.name) || 'building'}-${periodSlug(query)}.xlsx`

    return { buffer, fileName }
  },
}
