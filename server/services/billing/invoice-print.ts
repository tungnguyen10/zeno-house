import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BillingPeriod, Invoice, InvoicePrintItem } from '~/types/billing'
import { BILLING_AUDIT_ACTIONS } from '~/utils/constants/billing'
import { BuildingRepository } from '../../repositories/buildings'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { assertBuildingScope } from '../../utils/scope'
import { newCorrelationId } from '../../utils/billing/correlation'
import { BillingAuditService } from './audit'
import { BillingDisplayResolver } from './display'
import { deriveInvoiceListStatus } from './invoice-query'

interface ResolvedPrintInvoices {
  invoices: Invoice[]
  periodById: Map<string, BillingPeriod>
}

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values)]
}

async function resolveActiveInvoices(
  event: H3Event,
  user: AuthUser,
  invoiceIds: string[],
): Promise<ResolvedPrintInvoices> {
  if (!can(user, 'billing.read')) throwForbidden('Không có quyền in hoá đơn')

  const orderedIds = uniqueInOrder(invoiceIds)
  const loaded = await InvoiceRepository.findManyByIdentifiers(event, orderedIds)
  const invoiceById = new Map(loaded.map(invoice => [invoice.id, invoice]))
  const invoices = orderedIds.map((id) => {
    const invoice = invoiceById.get(id)
    if (!invoice) throwNotFound('Không tìm thấy hoá đơn')
    return invoice
  })

  if (invoices.some(invoice => invoice.status === 'void')) {
    throwConflict('Hoá đơn đã huỷ không thể in')
  }
  if (invoices.some(invoice => invoice.status === 'draft')) {
    throwConflict('Hoá đơn chưa phát hành không thể in')
  }

  const periods = await BillingPeriodRepository.findManyByIds(
    event,
    invoices.map(invoice => invoice.billingPeriodId),
  )
  const periodById = new Map(periods.map(period => [period.id, period]))
  for (const invoice of invoices) {
    if (!periodById.has(invoice.billingPeriodId)) throwNotFound('Không tìm thấy kỳ vận hành')
  }

  const buildingIds = uniqueInOrder(periods.map(period => period.buildingId))
  await Promise.all(buildingIds.map(buildingId =>
    assertBuildingScope(event, user, buildingId, 'read'),
  ))

  return { invoices, periodById }
}

export const InvoicePrintService = {
  async getPrintData(
    event: H3Event,
    user: AuthUser,
    invoiceIds: string[],
  ): Promise<InvoicePrintItem[]> {
    const { invoices, periodById } = await resolveActiveInvoices(event, user, invoiceIds)
    const buildingIds = uniqueInOrder(
      [...periodById.values()].map(period => period.buildingId),
    )
    const [buildings, chargesByInvoice, enrichedInvoices] = await Promise.all([
      BuildingRepository.findManyByIds(event, buildingIds),
      InvoiceRepository.listChargesByInvoiceIds(event, invoices.map(invoice => invoice.id)),
      new BillingDisplayResolver(event).enrichInvoices(invoices),
    ])
    const buildingById = new Map(buildings.map(building => [building.id, building]))

    return enrichedInvoices.map((invoice) => {
      const period = periodById.get(invoice.billingPeriodId)
      if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
      const building = buildingById.get(period.buildingId)
      if (!building) throwNotFound('Không tìm thấy tòa nhà')
      return {
        invoice: {
          ...invoice,
          status: deriveInvoiceListStatus({
            status: invoice.status,
            due_date: invoice.dueDate,
            balance_amount: invoice.balanceAmount,
          }),
        },
        charges: chargesByInvoice.get(invoice.id) ?? [],
        period,
        building: {
          id: building.id,
          name: building.name,
          address: building.address,
        },
      }
    })
  },

  async recordPrinted(
    event: H3Event,
    user: AuthUser,
    invoiceIds: string[],
  ): Promise<{ printed: number }> {
    const { invoices, periodById } = await resolveActiveInvoices(event, user, invoiceIds)
    const correlationId = newCorrelationId()
    await Promise.all(invoices.map((invoice) => {
      const period = periodById.get(invoice.billingPeriodId)
      if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
      return BillingAuditService.append(event, user, {
        billing_period_id: period.id,
        action: BILLING_AUDIT_ACTIONS.INVOICE_PRINTED,
        entity_type: 'invoice',
        entity_id: invoice.id,
        correlation_id: correlationId,
        before_data: null,
        after_data: null,
        metadata: { invoice_id: invoice.id, format: 'print' },
      })
    }))
    return { printed: invoices.length }
  },
}
