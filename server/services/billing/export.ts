import type { H3Event } from 'h3'
import ExcelJS from 'exceljs'
import { db } from '../../utils/db'
import type { AuthUser } from '~/types/auth'
import type {
  BillingPeriod,
  InvoiceCharge,
} from '~/types/billing'
import type { ChargeType } from '~/utils/constants/billing'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BillingDisplayResolver } from './display'
import { BillingAuditService } from './audit'
import { BILLING_AUDIT_ACTIONS } from '~/utils/constants/billing'
import { newCorrelationId } from '../../utils/billing/correlation'
import { assertBuildingScope } from '../../utils/scope'

const TABLE_COLUMN_COUNT = 11
const TABLE_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, m => (m === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'building'
}

function periodSlug(period: BillingPeriod): string {
  return `${period.periodYear}-${String(period.periodMonth).padStart(2, '0')}`
}

function moneyFormat(): string {
  return '#,##0'
}

function viPeriodTitle(period: BillingPeriod): string {
  return `${String(period.periodMonth).padStart(2, '0')}/${period.periodYear}`
}

function viExportDate(date = new Date()): string {
  return `Ngày ${String(date.getDate()).padStart(2, '0')} tháng ${String(date.getMonth() + 1).padStart(2, '0')} năm ${date.getFullYear()}`
}

function metaNumber(meta: Record<string, unknown>, key: string): number | null {
  const value = meta[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function readingRange(charges: InvoiceCharge[], chargeType: 'electricity' | 'water'): string {
  const charge = charges.find(c => c.chargeType === chargeType)
  if (!charge) return ''
  const previous = metaNumber(charge.metadata, 'previous_reading_value')
  const current = metaNumber(charge.metadata, 'current_reading_value')
  if (previous === null && current === null) return ''
  if (previous === null) return String(current)
  if (current === null) return String(previous)
  return `${previous} - ${current}`
}

function chargeTotalsFor(charges: InvoiceCharge[]): Record<ChargeType, number> {
  const totals: Record<ChargeType, number> = {
    rent: 0,
    electricity: 0,
    water: 0,
    service: 0,
    discount: 0,
    surcharge: 0,
    adjustment: 0,
  }
  for (const c of charges) totals[c.chargeType] += c.amount
  return totals
}

function styleTitleRow(row: ExcelJS.Row, size: number) {
  row.font = { bold: true, size, name: 'Times New Roman' }
  row.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true }
}

function styleTableRow(row: ExcelJS.Row, bold = false) {
  row.font = { bold, size: 14, name: 'Times New Roman' }
  row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, shrinkToFit: true }
  for (let col = 1; col <= TABLE_COLUMN_COUNT; col++) {
    const cell = row.getCell(col)
    cell.border = TABLE_BORDER
    cell.alignment = row.alignment
    cell.font = row.font
  }
}

function alignMoneyCells(row: ExcelJS.Row) {
  for (let col = 5; col <= 10; col++) {
    row.getCell(col).alignment = { horizontal: 'right', vertical: 'middle', shrinkToFit: true }
  }
}

export interface BuildPeriodWorkbookResult {
  buffer: Buffer
  fileName: string
}

export const BillingExportService = {
  async buildPeriodWorkbook(
    event: H3Event,
    user: AuthUser,
    periodId: string,
  ): Promise<BuildPeriodWorkbookResult> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xuất Excel kỳ vận hành')

    const period = await BillingPeriodRepository.findById(event, periodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'read')

    const supabase = db(event)
    const { data: buildingRow } = await supabase
      .from('buildings')
      .select('name')
      .eq('id', period.buildingId)
      .maybeSingle()
    const buildingName = (buildingRow?.name as string | null) ?? 'Toà nhà'
    const buildingSlugValue = slugify(buildingName)

    const rawInvoices = await InvoiceRepository.listByPeriod(event, period.id)
    const resolver = new BillingDisplayResolver(event)
    const invoices = await resolver.enrichInvoices(rawInvoices)

    const chargesByInvoice = new Map<string, InvoiceCharge[]>()
    await Promise.all(
      invoices.map(async ({ id }) => {
        const charges = await InvoiceRepository.listCharges(event, id)
        chargesByInvoice.set(id, charges)
      }),
    )

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Zeno House'
    wb.created = new Date()

    const activeInvoices = invoices
      .filter(i => i.status !== 'void')
      .sort((a, b) => (a.roomNumber ?? '').localeCompare(b.roomNumber ?? '', 'vi', { numeric: true }))

    const sheet = wb.addWorksheet('Thu tiền phòng')
    sheet.columns = [
      { key: 'index', width: 8 },
      { key: 'room', width: 12 },
      { key: 'electricityReading', width: 20 },
      { key: 'waterReading', width: 20 },
      { key: 'electricityAmount', width: 17, style: { numFmt: moneyFormat() } },
      { key: 'waterAmount', width: 17, style: { numFmt: moneyFormat() } },
      { key: 'rentAmount', width: 17, style: { numFmt: moneyFormat() } },
      { key: 'otherAmount', width: 19, style: { numFmt: moneyFormat() } },
      { key: 'discountAmount', width: 17, style: { numFmt: moneyFormat() } },
      { key: 'totalAmount', width: 18, style: { numFmt: moneyFormat() } },
      { key: 'note', width: 24 },
    ]

    sheet.mergeCells('A1:K1')
    sheet.getCell('A1').value = `DANH SÁCH THU TIỀN PHÒNG ĐỢT ${viPeriodTitle(period)}`
    styleTitleRow(sheet.getRow(1), 20)
    sheet.getRow(1).height = 40

    sheet.mergeCells('A2:K2')
    sheet.getCell('A2').value = buildingName
    styleTitleRow(sheet.getRow(2), 18)
    sheet.getRow(2).height = 32

    const header = sheet.getRow(3)
    header.values = [
      'STT',
      'Phòng',
      'Số điện mới',
      'Số nước mới',
      'Tiền điện',
      'Tiền nước',
      'Tiền phòng',
      'Phụ phí/Dịch vụ',
      'Giảm giá',
      'Tổng',
      'Ghi chú',
    ]
    styleTableRow(header, true)
    header.height = 34

    const totals = {
      electricity: 0,
      water: 0,
      rent: 0,
      other: 0,
      discount: 0,
      total: 0,
    }

    activeInvoices.forEach((inv, index) => {
      const charges = chargesByInvoice.get(inv.id) ?? []
      const chargeTotals = chargeTotalsFor(charges)
      const otherAmount = chargeTotals.service + chargeTotals.surcharge + chargeTotals.adjustment
      const discountAmount = chargeTotals.discount
      totals.electricity += chargeTotals.electricity
      totals.water += chargeTotals.water
      totals.rent += chargeTotals.rent
      totals.other += otherAmount
      totals.discount += discountAmount
      totals.total += inv.totalAmount

      const row = sheet.addRow({
        index: index + 1,
        room: inv.roomNumber ?? '',
        electricityReading: readingRange(charges, 'electricity'),
        waterReading: readingRange(charges, 'water'),
        electricityAmount: chargeTotals.electricity,
        waterAmount: chargeTotals.water,
        rentAmount: chargeTotals.rent,
        otherAmount,
        discountAmount,
        totalAmount: inv.totalAmount,
        note: '',
      })
      styleTableRow(row)
      alignMoneyCells(row)
      row.height = 28
      row.getCell('room').font = { bold: true, size: 14, name: 'Times New Roman' }
      row.getCell('totalAmount').font = { bold: true, size: 14, name: 'Times New Roman' }
    })

    const totalRow = sheet.addRow({
      electricityAmount: totals.electricity,
      waterAmount: totals.water,
      rentAmount: totals.rent,
      otherAmount: totals.other,
      discountAmount: totals.discount,
      totalAmount: totals.total,
    })
    sheet.mergeCells(totalRow.number, 1, totalRow.number, 4)
    totalRow.getCell(1).value = 'TỔNG TIỀN'
    styleTableRow(totalRow, true)
    alignMoneyCells(totalRow)
    totalRow.height = 30

    const dateRow = sheet.addRow([])
    sheet.mergeCells(dateRow.number, 1, dateRow.number, 11)
    dateRow.getCell(1).value = viExportDate()
    dateRow.getCell(1).font = { size: 14, name: 'Times New Roman' }
    dateRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }

    const arrayBuffer = await wb.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer)
    const fileName = `billing-${buildingSlugValue}-${periodSlug(period)}.xlsx`

    await BillingAuditService.append(event, user, {
      billing_period_id: period.id,
      action: BILLING_AUDIT_ACTIONS.INVOICE_PRINTED,
      entity_type: 'billing_period',
      entity_id: period.id,
      before_data: null,
      after_data: null,
      metadata: { format: 'xlsx', invoice_count: activeInvoices.length },
    })

    return { buffer, fileName }
  },

  /**
   * Record that one or more invoices were printed from the client print view
   * (`window.print()`). Emits one `invoice.printed` audit event per invoice,
   * sharing a single correlation id so the batch can be grouped in the audit
   * drawer. Only invoices that actually belong to the period are recorded.
   */
  async recordInvoicesPrinted(
    event: H3Event,
    user: AuthUser,
    periodId: string,
    invoiceIds: string[],
  ): Promise<{ printed: number }> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền in hoá đơn')

    const period = await BillingPeriodRepository.findById(event, periodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'read')

    const periodInvoiceIds = new Set(
      (await InvoiceRepository.listByPeriod(event, period.id)).map(inv => inv.id),
    )
    const targets = [...new Set(invoiceIds)].filter(id => periodInvoiceIds.has(id))
    if (targets.length === 0) return { printed: 0 }

    const correlationId = newCorrelationId()
    await Promise.all(targets.map(invoiceId =>
      BillingAuditService.append(event, user, {
        billing_period_id: period.id,
        action: BILLING_AUDIT_ACTIONS.INVOICE_PRINTED,
        entity_type: 'invoice',
        entity_id: invoiceId,
        correlation_id: correlationId,
        before_data: null,
        after_data: null,
        metadata: { invoice_id: invoiceId, format: 'print' },
      }),
    ))

    return { printed: targets.length }
  },
}
