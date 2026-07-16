import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { TenantInvoiceDetail, TenantInvoiceListItem } from '~/types/tenant-portal'
import type { TenantInvoiceListQuery } from '~/utils/validators/tenant-portal'
import { mapTenantInvoiceDetail, mapTenantInvoiceListItem } from '~/utils/mappers/tenant-portal'
import { TenantInvoiceRepository } from '../../repositories/tenant-portal/invoices'
import { deriveInvoiceListStatus } from '../billing/invoice-query'
import { resolveTenantId } from '../../utils/scope'
import { can } from '../../utils/permissions'
import { throwForbidden, throwNotFound } from '../../utils/errors'

function todayInHoChiMinh(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export const TenantInvoiceService = {
  async list(
    event: H3Event,
    user: AuthUser,
    query: TenantInvoiceListQuery,
    today = todayInHoChiMinh(),
  ): Promise<{
    data: TenantInvoiceListItem[]
    meta: { total: number; page: number; limit: number; totalPages: number }
  }> {
    if (!can(user, 'tenant.invoices.read')) throwForbidden('Không có quyền xem hoá đơn')
    const id = await resolveTenantId(event, user)
    const { items, total } = await TenantInvoiceRepository.list(event, id, query, today)
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
    today = todayInHoChiMinh(),
  ): Promise<TenantInvoiceDetail> {
    if (!can(user, 'tenant.invoices.read')) throwForbidden('Không có quyền xem hoá đơn')
    const id = await resolveTenantId(event, user)
    const detail = await TenantInvoiceRepository.findDetail(event, id, invoiceId)
    if (!detail) throwNotFound()
    return mapTenantInvoiceDetail({
      ...detail.invoice,
      status: deriveInvoiceListStatus(detail.invoice, today),
    }, detail.charges)
  },
}
