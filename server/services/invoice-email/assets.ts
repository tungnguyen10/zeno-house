import type { H3Event } from 'h3'
import type {
  InvoiceDocumentAssets,
  InvoiceDocumentData,
} from '../../types/invoice-email'
import { BuildingInvoiceProfileRepository } from '../../repositories/building-invoice-profiles'

const FONT_KEY = 'invoice-email/Inter[opsz,wght].ttf'
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

async function downloadOptionalAsset(
  event: H3Event,
  path: string | null,
): Promise<Buffer | null> {
  if (!path) return null
  try {
    const asset = await BuildingInvoiceProfileRepository.downloadAsset(event, path)
    if (!ALLOWED_IMAGE_TYPES.has(asset.contentType) || asset.data.byteLength > MAX_IMAGE_BYTES) {
      return null
    }
    return asset.data
  }
  catch {
    return null
  }
}

export const InvoiceEmailAssetService = {
  async load(event: H3Event, data: InvoiceDocumentData): Promise<InvoiceDocumentAssets> {
    const font = await useStorage('assets:server').getItemRaw<Buffer>(FONT_KEY)
    if (!font) throw new Error('INVOICE_PDF_FONT_MISSING')

    return {
      font: Buffer.from(font),
      qrImage: await downloadOptionalAsset(event, data.paymentProfile?.qrImagePath ?? null),
      logoImage: await downloadOptionalAsset(event, data.paymentProfile?.logoImagePath ?? null),
    }
  },
}
