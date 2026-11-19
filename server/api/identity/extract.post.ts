import { getHeader, readMultipartFormData, setResponseHeader } from 'h3'
import { identityPurposeSchema } from '~/utils/validators/identity-extraction'
import { IdentityExtractionService } from '../../services/identity/extraction'

// Two 5 MiB images plus multipart overhead.
const MAX_BODY_BYTES = 12 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  setResponseHeader(event, 'Cache-Control', 'no-store')

  const contentLength = Number(getHeader(event, 'content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    throw createError({
      statusCode: 413,
      data: { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Ảnh quá lớn (tối đa 5 MB mỗi ảnh).' } },
    })
  }

  const form = await readMultipartFormData(event)
  const purpose = identityPurposeSchema.safeParse(form?.find(part => part.name === 'purpose')?.data.toString('utf8'))
  if (!purpose.success) throwValidationError('Mục đích đọc ảnh không hợp lệ')

  const parts = (form ?? [])
    .filter(part => (part.name === 'images[]' || part.name === 'images') && part.data.length > 0)
    .map(part => ({ data: part.data, filename: part.filename, type: part.type }))

  const { suggestion, model } = await IdentityExtractionService.extract(event, user, purpose.data, parts)

  return { data: suggestion, meta: { model } }
})
