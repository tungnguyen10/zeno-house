import { inventoryApplySchema } from '~/utils/validators/inventory'
import { InventoryService } from '../../../../services/inventory'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const result = inventoryApplySchema.safeParse(await readBody(event))
  if (!result.success) throwValidationError('Yêu cầu áp dụng không hợp lệ', result.error.flatten())
  return { data: await InventoryService.applyTemplate(event, user, id, result.data) }
})
