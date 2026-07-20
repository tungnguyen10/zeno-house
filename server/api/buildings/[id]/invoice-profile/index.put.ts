import { readMultipartFormData } from 'h3'
import { buildingInvoiceProfileFieldsSchema } from '~/utils/validators/building-invoice-profile'
import { BuildingInvoiceProfileService } from '../../../../services/buildings/invoice-profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const form = await readMultipartFormData(event)
  if (!form) throwValidationError('Yêu cầu phải dùng multipart/form-data')

  const text = (name: string) => form.find(part => part.name === name)?.data.toString()
  const parsed = buildingInvoiceProfileFieldsSchema.safeParse({
    bank_name: text('bank_name'),
    account_holder: text('account_holder'),
    account_number: text('account_number'),
    transfer_content_template: text('transfer_content_template'),
  })
  if (!parsed.success) {
    throwValidationError('Thông tin thanh toán không hợp lệ', parsed.error.flatten())
  }

  const qrImage = form.find(part => part.name === 'qr_image' && part.data.length > 0)
  const logoImage = form.find(part => part.name === 'logo_image' && part.data.length > 0)
  const removeLogo = text('remove_logo') === 'true'

  return {
    data: await BuildingInvoiceProfileService.save(event, user, id, {
      fields: parsed.data,
      removeLogo,
      qrImage: qrImage
        ? { filename: qrImage.filename, type: qrImage.type, data: qrImage.data }
        : undefined,
      logoImage: logoImage
        ? { filename: logoImage.filename, type: logoImage.type, data: logoImage.data }
        : undefined,
    }),
  }
})
