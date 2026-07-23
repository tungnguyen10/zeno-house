import { BuildingInvoiceEmailSettingsService } from '../../../../services/buildings/invoice-email-settings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  return { data: await BuildingInvoiceEmailSettingsService.get(event, user, id) }
})
