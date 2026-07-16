import { TenantInvoiceService } from '../../../services/tenant-portal/invoices'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Mã hoá đơn không hợp lệ')
  return { data: await TenantInvoiceService.getDetail(event, user, id) }
})
