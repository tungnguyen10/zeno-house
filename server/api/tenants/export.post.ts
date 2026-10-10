import { tenantExportBodySchema } from '~/utils/validators/tenants'
import { TenantExportService } from '../../services/tenants/export'
import { setXlsxResponse } from '../../utils/excel'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, tenantExportBodySchema)
  const { buffer, fileName } = await TenantExportService.buildWorkbook(event, user, input)
  setXlsxResponse(event, buffer, fileName)
  return buffer
})
