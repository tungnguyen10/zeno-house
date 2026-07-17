import { readMultipartFormData } from 'h3'
import { tenantSupportRequestCreateSchema } from '~/utils/validators/tenant-portal'
import { TenantSupportRequestService } from '../../../services/tenant-portal/requests'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await resolveTenantId(event, user)

  const contentType = getHeader(event, 'content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    const input = await parseBody(event, tenantSupportRequestCreateSchema)
    return {
      data: await TenantSupportRequestService.create(event, user, {
        title: input.title,
        description: input.description,
      }),
    }
  }

  const form = await readMultipartFormData(event)
  const title = form?.find(part => part.name === 'title')?.data.toString()
  const description = form?.find(part => part.name === 'description')?.data.toString()
  const file = form?.find(part => part.name === 'attachment' && part.data.length > 0)
  const parsed = tenantSupportRequestCreateSchema.safeParse({
    title,
    description,
    attachment: file
      ? {
          name: file.filename ?? 'attachment',
          mimeType: file.type ?? '',
          size: file.data.length,
        }
      : undefined,
  })
  if (!parsed.success) {
    throwValidationError('Yêu cầu hỗ trợ không hợp lệ', parsed.error.flatten())
  }

  return {
    data: await TenantSupportRequestService.create(event, user, {
      title: parsed.data.title,
      description: parsed.data.description,
      attachment: file
        ? {
            name: parsed.data.attachment!.name,
            mimeType: parsed.data.attachment!.mimeType,
            data: file.data,
          }
        : undefined,
    }),
  }
})
