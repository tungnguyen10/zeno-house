import { BuildingInvoiceProfileService } from '../../../../services/buildings/invoice-profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  return { data: await BuildingInvoiceProfileService.get(event, user, id) }
})
