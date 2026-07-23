import { InvoiceEmailDeliveryService } from '../../../../services/invoice-email/deliveries'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  return { data: await InvoiceEmailDeliveryService.history(event, user, id) }
})
