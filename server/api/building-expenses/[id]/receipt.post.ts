import { readMultipartFormData } from 'h3'
import { BuildingExpenseService } from '../../../services/operations-report/expenses'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'receipt' && part.data.length > 0)

  if (!file) throwValidationError('Thieu file bien lai')

  const expense = await BuildingExpenseService.uploadReceipt(event, user, id, {
    filename: file.filename,
    type: file.type,
    data: file.data,
  })

  return { data: expense }
})
