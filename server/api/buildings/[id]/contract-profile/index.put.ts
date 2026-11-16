import { buildingContractProfileSchema } from '~/utils/validators/building-contract-profile'
import { BuildingContractProfileService } from '../../../../services/buildings/contract-profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const result = buildingContractProfileSchema.safeParse(await readBody(event))
  if (!result.success) {
    throwValidationError('Thông tin hợp đồng không hợp lệ', result.error.flatten().fieldErrors)
  }
  return { data: await BuildingContractProfileService.save(event, user, id, result.data) }
})
