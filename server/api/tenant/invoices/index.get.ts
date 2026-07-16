import { tenantInvoiceListQuerySchema } from '~/utils/validators/tenant-portal'
import { TenantInvoiceService } from '../../../services/tenant-portal/invoices'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)
  const input = parseQuery(event, tenantInvoiceListQuerySchema, 'Bộ lọc hoá đơn không hợp lệ')
  return TenantInvoiceService.list(event, user, input)
})
