import { invoiceEmailSettingsUpdateSchema } from '~/utils/validators/invoice-email'
import { BuildingInvoiceEmailSettingsService } from '../../../../services/buildings/invoice-email-settings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const parsed = invoiceEmailSettingsUpdateSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throwValidationError('Cấu hình gửi hoá đơn không hợp lệ', parsed.error.flatten())
  }
  return {
    data: await BuildingInvoiceEmailSettingsService.update(
      event,
      user,
      id,
      parsed.data.auto_send_enabled,
    ),
  }
})
