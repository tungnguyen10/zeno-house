import { buildingContractProfileSchema } from '~/utils/validators/building-contract-profile'
import { BuildingContractProfileService } from '../../../../services/buildings/contract-profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throwValidationError('Thiếu mã tòa nhà')

  const input = await parseBody(event, buildingContractProfileSchema, 'Thông tin hợp đồng không hợp lệ')
  return { data: await BuildingContractProfileService.save(event, user, id, input) }
})
