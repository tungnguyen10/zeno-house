import { BuildingContractProfileService } from '../../../services/buildings/contract-profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã tòa nhà')

  return { data: await BuildingContractProfileService.readiness(event, user, id) }
})
