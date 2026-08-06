import type { H3Event } from 'h3'
import type { InvoiceDocumentData } from '../../types/invoice-email'
import { parseStoredInvoiceProfileSnapshot } from '~/utils/mappers/building-invoice-profile'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BuildingRepository } from '../../repositories/buildings'
import { BuildingInvoiceProfileRepository } from '../../repositories/building-invoice-profiles'
import { BillingDisplayResolver } from '../billing/display'
import { deriveInvoiceListStatus } from '../billing/invoice-query'

export const InvoiceEmailDocumentService = {
  async build(event: H3Event, invoiceId: string): Promise<InvoiceDocumentData> {
    const invoice = await InvoiceRepository.findById(event, invoiceId)
    if (!invoice) throwNotFound('Không tìm thấy hoá đơn')
    if (invoice.status === 'void' || invoice.status === 'draft') {
      throwConflict('Hoá đơn chưa sẵn sàng để gửi email')
    }

    const period = await BillingPeriodRepository.findById(event, invoice.billingPeriodId)
    if (!period) throwNotFound('Không tìm thấy kỳ vận hành')

    const resolver = new BillingDisplayResolver(event)
    const [buildings, charges, tenants, rooms, snapshots] = await Promise.all([
      BuildingRepository.findManyByIds(event, [period.buildingId]),
      InvoiceRepository.listCharges(event, invoice.id),
      resolver.loadTenants([invoice.tenantId]),
      resolver.loadRooms([invoice.roomId]),
      BuildingInvoiceProfileRepository.findInvoiceSnapshotsByIds(event, [invoice.id]),
    ])
    const building = buildings[0]
    if (!building) throwNotFound('Không tìm thấy toà nhà')

    const tenant = tenants.get(invoice.tenantId)
    const room = rooms.get(invoice.roomId)
    const paymentProfile = parseStoredInvoiceProfileSnapshot(snapshots.get(invoice.id))

    return {
      invoiceId: invoice.id,
      invoiceCode: invoice.invoiceCode,
      status: deriveInvoiceListStatus({
        status: invoice.status,
        overdue_date: invoice.overdueDate,
        balance_amount: invoice.balanceAmount,
      }),
      issuedAt: invoice.issuedAt,
      dueDate: invoice.dueDate,
      gracePeriodDays: invoice.gracePeriodDays,
      overdueDate: invoice.overdueDate,
      periodLabel: `${String(period.periodMonth).padStart(2, '0')}/${period.periodYear}`,
      buildingName: building.name,
      buildingAddress: building.address,
      roomNumber: room?.roomNumber ?? '—',
      tenantName: tenant?.fullName ?? 'Khách thuê',
      subtotalAmount: invoice.subtotalAmount,
      discountAmount: invoice.discountAmount,
      surchargeAmount: invoice.surchargeAmount,
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.paidAmount,
      balanceAmount: invoice.balanceAmount,
      notes: invoice.notes,
      charges: charges.map(charge => ({
        chargeType: charge.chargeType,
        label: charge.label,
        quantity: charge.quantity,
        unitPrice: charge.unitPrice,
        amount: charge.amount,
        metadata: charge.metadata,
      })),
      paymentProfile,
    }
  },
}
