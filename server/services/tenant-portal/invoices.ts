import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { TenantFinancialSummary, TenantInvoiceDetail, TenantInvoiceListItem } from '~/types/tenant-portal'
import type { TenantInvoiceListQuery } from '~/utils/validators/tenant-portal'
import { mapTenantInvoiceDetail, mapTenantInvoiceListItem } from '~/utils/mappers/tenant-portal'
import { TenantInvoiceRepository, type TenantInvoiceScope } from '../../repositories/tenant-portal/invoices'
import { TenantHousingRepository } from '../../repositories/tenant-portal/housing'
import { BuildingInvoiceProfileRepository } from '../../repositories/building-invoice-profiles'
import { deriveInvoiceListStatus } from '../billing/invoice-query'
import { InvoiceProfileDisplayService } from '../billing/invoice-profile-display'
import { resolveTenantId } from '../../utils/scope'
import { can } from '../../utils/permissions'
import { throwForbidden, throwNotFound } from '../../utils/errors'
import { compareTenantInvoicePriority, isOverdueTenantInvoice, isPayableTenantInvoice } from '~/utils/tenant-portal/invoice-statement'
import { vietnamDateISO } from '../../utils/date'

async function resolveInvoiceScope(
  event: H3Event,
  tenantId: string,
  today: string,
): Promise<TenantInvoiceScope> {
  const housing = await TenantHousingRepository.resolveActive(event, tenantId, today)
  return housing?.assignmentRole === 'roommate'
    ? { contractId: housing.contractId }
    : { tenantId }
}

export const TenantInvoiceService = {
  async getFinancialSummary(
    event: H3Event,
    user: AuthUser,
    today = vietnamDateISO(),
  ): Promise<TenantFinancialSummary> {
    if (!can(user, 'tenant.invoices.read')) throwForbidden('Không có quyền xem hoá đơn')
    const tenantId = await resolveTenantId(event, user)
    const scope = await resolveInvoiceScope(event, tenantId, today)
    const rows = await TenantInvoiceRepository.listOutstanding(event, scope, today)
    const payable = rows.map(row => mapTenantInvoiceListItem({
      ...row,
      status: deriveInvoiceListStatus(row, today),
    })).filter(isPayableTenantInvoice)
    const overdue = payable.filter(invoice => isOverdueTenantInvoice(invoice, today))
    return {
      outstandingAmount: payable.reduce((sum, invoice) => sum + invoice.balanceAmount, 0),
      outstandingCount: payable.length,
      overdueAmount: overdue.reduce((sum, invoice) => sum + invoice.balanceAmount, 0),
      overdueCount: overdue.length,
      nextInvoice: payable.sort((left, right) => compareTenantInvoicePriority(left, right, today))[0] ?? null,
    }
  },

  async list(
    event: H3Event,
    user: AuthUser,
    query: TenantInvoiceListQuery,
    today = vietnamDateISO(),
  ): Promise<{
    data: TenantInvoiceListItem[]
    meta: { total: number; page: number; limit: number; totalPages: number }
  }> {
    if (!can(user, 'tenant.invoices.read')) throwForbidden('Không có quyền xem hoá đơn')
    const id = await resolveTenantId(event, user)
    const scope = await resolveInvoiceScope(event, id, today)
    const { items, total } = await TenantInvoiceRepository.list(event, scope, query, today)
    return {
      data: items.map(item => mapTenantInvoiceListItem({
        ...item,
        status: deriveInvoiceListStatus(item, today),
      })),
      meta: {
        total,
        page: query.page,
        limit: query.page_size,
        totalPages: Math.ceil(total / query.page_size),
      },
    }
  },

  async getDetail(
    event: H3Event,
    user: AuthUser,
    invoiceId: string,
    today = vietnamDateISO(),
  ): Promise<TenantInvoiceDetail> {
    if (!can(user, 'tenant.invoices.read')) throwForbidden('Không có quyền xem hoá đơn')
    const id = await resolveTenantId(event, user)
    const scope = await resolveInvoiceScope(event, id, today)
    const detail = await TenantInvoiceRepository.findDetail(event, scope, invoiceId)
    if (!detail) throwNotFound()
    const snapshots = await BuildingInvoiceProfileRepository.findInvoiceSnapshotsByIds(
      event,
      [detail.invoice.id],
    )
    const profiles = await InvoiceProfileDisplayService.resolveMany(event, snapshots)
    return mapTenantInvoiceDetail({
      ...detail.invoice,
      status: deriveInvoiceListStatus(detail.invoice, today),
    }, detail.charges, profiles.get(detail.invoice.id) ?? null, detail.payments)
  },
}
