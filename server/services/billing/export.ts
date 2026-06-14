import type { H3Event } from 'h3'
import ExcelJS from 'exceljs'
import { serverSupabaseClient } from '#supabase/server'
import type { AuthUser } from '~/types/auth'
import type {
  BillingPeriod,
  Invoice,
  InvoiceCharge,
} from '~/types/billing'
import type { ChargeType } from '~/utils/constants/billing'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { InvoicePaymentRepository } from '../../repositories/billing/payments'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BillingDisplayResolver } from './display'

const INVOICE_STATUS_LABEL: Record<Invoice['status'], string> = {
  draft: 'Nháp',
  issued: 'Đã phát hành',
  partial: 'Trả một phần',
  paid: 'Đã thu đủ',
  overdue: 'Quá hạn',
  void: 'Đã huỷ',
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

    const supabase = await serverSupabaseClient(event)
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

    const invoiceIds = invoices.map(i => i.id)
    const allPayments = await InvoicePaymentRepository.listByInvoiceIds(event, invoiceIds)
    const enrichedPayments = await resolver.enrichPayments(allPayments)

    const chargesByInvoice = new Map<string, InvoiceCharge[]>()
    await Promise.all(
      invoiceIds.map(async (id) => {
        const charges = await InvoiceRepository.listCharges(event, id)
        chargesByInvoice.set(id, charges)
      }),
    )

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Zeno House'
    wb.created = new Date()

    // ---- Sheet 1: Hoá đơn -----------------------------------------------
    const sheetInvoices = wb.addWorksheet('Hoá đơn')
    sheetInvoices.columns = [
      { header: 'Phòng', key: 'room', width: 10 },
      { header: 'Khách thuê', key: 'tenant', width: 24 },
      { header: 'Mã hợp đồng', key: 'contract', width: 16 },
      { header: 'Mã hoá đơn', key: 'invoiceId', width: 16 },
      { header: 'Ngày phát hành', key: 'issuedAt', width: 16 },
      { header: 'Hạn thanh toán', key: 'dueDate', width: 16 },
      { header: 'Tiền nhà', key: 'rent', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Tiền điện', key: 'electricity', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Tiền nước', key: 'water', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Dịch vụ khác', key: 'service', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Điều chỉnh', key: 'adjustment', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Tổng', key: 'total', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Đã thu', key: 'paid', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Còn lại', key: 'balance', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Trạng thái', key: 'status', width: 14 },
    ]
    sheetInvoices.getRow(1).font = { bold: true }
    for (const inv of invoices) {
      const totals = chargeTotalsFor(chargesByInvoice.get(inv.id) ?? [])
      sheetInvoices.addRow({
        room: inv.roomNumber ?? '',
        tenant: inv.tenantName ?? '',
        contract: inv.contractCode ?? '',
        invoiceId: inv.id.slice(0, 8),
        issuedAt: inv.issuedAt ? new Date(inv.issuedAt) : '',
        dueDate: inv.dueDate ? new Date(inv.dueDate) : '',
        rent: totals.rent,
        electricity: totals.electricity,
        water: totals.water,
        service: totals.service,
        adjustment: totals.adjustment + totals.discount + totals.surcharge,
        total: inv.totalAmount,
        paid: inv.paidAmount,
        balance: inv.balanceAmount,
        status: INVOICE_STATUS_LABEL[inv.status],
      })
    }

    // ---- Sheet 2: Thanh toán --------------------------------------------
    const sheetPayments = wb.addWorksheet('Thanh toán')
    sheetPayments.columns = [
      { header: 'Thời gian', key: 'paidAt', width: 18 },
      { header: 'Phòng', key: 'room', width: 10 },
      { header: 'Khách thuê', key: 'tenant', width: 24 },
      { header: 'Số tiền', key: 'amount', width: 14, style: { numFmt: '#,##0' } },
      { header: 'Phương thức', key: 'method', width: 16 },
      { header: 'Người ghi nhận', key: 'recordedBy', width: 24 },
      { header: 'Ghi chú', key: 'note', width: 32 },
    ]
    sheetPayments.getRow(1).font = { bold: true }
    const invoiceById = new Map(invoices.map(inv => [inv.id, inv]))
    for (const p of enrichedPayments) {
      const inv = invoiceById.get(p.invoiceId)
      sheetPayments.addRow({
        paidAt: p.paidAt ? new Date(p.paidAt) : '',
        room: inv?.roomNumber ?? '',
        tenant: inv?.tenantName ?? '',
        amount: p.amount,
        method: p.paymentMethod ?? '',
        recordedBy: p.recordedByName ?? '',
        note: p.note ?? '',
      })
    }

    // ---- Sheet 3: Tổng hợp ----------------------------------------------
    const sheetSummary = wb.addWorksheet('Tổng hợp')
    sheetSummary.columns = [
      { header: 'Chỉ số', key: 'label', width: 30 },
      { header: 'Giá trị', key: 'value', width: 22, style: { numFmt: '#,##0' } },
    ]
    sheetSummary.getRow(1).font = { bold: true }

    const activeInvoices = invoices.filter(i => i.status !== 'void')
    const voidInvoices = invoices.filter(i => i.status === 'void')
    const paidInvoices = activeInvoices.filter(i => i.status === 'paid')
    const issuedTotal = activeInvoices.reduce((s, i) => s + i.totalAmount, 0)
    const paidTotal = activeInvoices.reduce((s, i) => s + i.paidAmount, 0)
    const outstanding = activeInvoices.reduce((s, i) => s + i.balanceAmount, 0)

    sheetSummary.addRow({ label: 'Toà nhà', value: buildingName })
    sheetSummary.addRow({ label: 'Kỳ', value: `${String(period.periodMonth).padStart(2, '0')}/${period.periodYear}` })
    sheetSummary.addRow({ label: 'Trạng thái kỳ', value: period.status })
    sheetSummary.addRow({ label: 'Số hoá đơn (active)', value: activeInvoices.length })
    sheetSummary.addRow({ label: 'Số hoá đơn đã thu đủ', value: paidInvoices.length })
    sheetSummary.addRow({ label: 'Số hoá đơn đã huỷ', value: voidInvoices.length })
    sheetSummary.addRow({ label: 'Tổng phát hành', value: issuedTotal })
    sheetSummary.addRow({ label: 'Tổng đã thu', value: paidTotal })
    sheetSummary.addRow({ label: 'Tổng còn lại', value: outstanding })
    sheetSummary.addRow({ label: 'Số khoản thanh toán', value: enrichedPayments.length })

    const arrayBuffer = await wb.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer)
    const fileName = `billing-${buildingSlugValue}-${periodSlug(period)}.xlsx`
    return { buffer, fileName }
  },
}
