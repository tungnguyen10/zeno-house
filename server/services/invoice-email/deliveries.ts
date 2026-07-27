import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type {
  InvoiceEmailDelivery,
  InvoiceEmailEnqueueItemResult,
  InvoiceEmailEnqueueResult,
} from '~/types/invoice-email'
import type { InvoiceEmailResendInput } from '~/utils/validators/invoice-email'
import { mapInvoiceEmailDelivery } from '~/utils/mappers/invoice-email'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { InvoiceEmailDeliveryRepository } from '../../repositories/invoice-email-deliveries'
import { assertBuildingScope } from '../../utils/scope'

function featureEnabled(event: H3Event): boolean {
  return useRuntimeConfig(event).public.invoiceEmailEnabled === true
}

function failed(
  identifier: string,
  invoiceId: string | null,
  reason: string,
): InvoiceEmailEnqueueItemResult {
  return {
    invoiceIdentifier: identifier,
    invoiceId,
    status: 'failed',
    delivery: null,
    reason,
  }
}

export const InvoiceEmailDeliveryService = {
  async enqueue(
    event: H3Event,
    user: AuthUser,
    identifiers: string[],
  ): Promise<InvoiceEmailEnqueueResult> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền gửi hoá đơn')
    if (!featureEnabled(event)) {
      throwConflict('Chức năng gửi hoá đơn qua email chưa được bật trên hệ thống')
    }
    if (!user.id) throwForbidden('Không xác định được người gửi')

    const invoices = await InvoiceRepository.findManyByIdentifiers(event, identifiers)
    const byIdentifier = new Map<string, (typeof invoices)[number]>()
    for (const invoice of invoices) {
      byIdentifier.set(invoice.id, invoice)
      byIdentifier.set(invoice.invoiceCode, invoice)
    }
    const periods = await BillingPeriodRepository.findManyByIds(
      event,
      invoices.map(invoice => invoice.billingPeriodId),
    )
    const periodsById = new Map(periods.map(period => [period.id, period]))

    const results: InvoiceEmailEnqueueItemResult[] = []
    for (const identifier of identifiers) {
      const invoice = byIdentifier.get(identifier)
      if (!invoice) {
        results.push(failed(identifier, null, 'Không tìm thấy hoá đơn'))
        continue
      }
      if (invoice.status === 'void' || invoice.status === 'draft') {
        results.push(failed(identifier, invoice.id, 'Hoá đơn không ở trạng thái có thể gửi'))
        continue
      }
      const period = periodsById.get(invoice.billingPeriodId)
      if (!period) {
        results.push(failed(identifier, invoice.id, 'Không tìm thấy kỳ vận hành'))
        continue
      }

      try {
        await assertBuildingScope(event, user, period.buildingId, 'write')
        const { row, reused } = await InvoiceEmailDeliveryRepository.enqueue(event, {
          invoiceId: invoice.id,
          actorId: user.id,
        })
        const delivery = mapInvoiceEmailDelivery(row)
        results.push({
          invoiceIdentifier: identifier,
          invoiceId: invoice.id,
          status: row.status === 'skipped'
            ? 'skipped'
            : reused ? 'already_queued' : 'queued',
          delivery,
          reason: row.skip_reason,
        })
      }
      catch {
        results.push(failed(identifier, invoice.id, 'Không thể xếp hàng gửi hoá đơn này'))
      }
    }

    return { results }
  },

  async resend(
    event: H3Event,
    user: AuthUser,
    invoiceIdentifier: string,
    input: InvoiceEmailResendInput,
  ): Promise<InvoiceEmailDelivery> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền gửi lại hoá đơn')
    if (!featureEnabled(event)) {
      throwConflict('Chức năng gửi hoá đơn qua email chưa được bật trên hệ thống')
    }
    if (!user.id) throwForbidden('Không xác định được người gửi')

    const invoice = await InvoiceRepository.findByIdentifier(event, invoiceIdentifier)
    if (!invoice) throwNotFound('Không tìm thấy hoá đơn')
    if (invoice.status === 'void' || invoice.status === 'draft') {
      throwConflict('Hoá đơn không ở trạng thái có thể gửi lại')
    }
    const period = await BillingPeriodRepository.findById(event, invoice.billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'write')

    return mapInvoiceEmailDelivery(await InvoiceEmailDeliveryRepository.resend(event, {
      invoiceId: invoice.id,
      actorId: user.id,
      confirmDuplicate: input.confirm_duplicate,
    }))
  },

  async history(
    event: H3Event,
    user: AuthUser,
    invoiceIdentifier: string,
  ): Promise<InvoiceEmailDelivery[]> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem lịch sử gửi hoá đơn')
    const invoice = await InvoiceRepository.findByIdentifier(event, invoiceIdentifier)
    if (!invoice) throwNotFound('Không tìm thấy hoá đơn')
    const period = await BillingPeriodRepository.findById(event, invoice.billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
    await assertBuildingScope(event, user, period.buildingId, 'read')
    return (await InvoiceEmailDeliveryRepository.listByInvoiceId(event, invoice.id))
      .map(mapInvoiceEmailDelivery)
  },
}
