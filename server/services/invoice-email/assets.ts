import type { H3Event } from 'h3'
import type {
  InvoiceDocumentImageAsset,
  InvoiceDocumentAssets,
  InvoiceDocumentData,
} from '../../types/invoice-email'
import { BuildingInvoiceProfileRepository } from '../../repositories/building-invoice-profiles'

const FONT_KEY = 'invoice-email/Inter[opsz,wght].ttf'
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function extensionFor(contentType: InvoiceDocumentImageAsset['contentType']): string {
  if (contentType === 'image/jpeg') return 'jpg'
  if (contentType === 'image/webp') return 'webp'
  return 'png'
}

async function downloadOptionalAsset(
  event: H3Event,
  path: string | null,
  filename: string,
  cid: string,
): Promise<InvoiceDocumentImageAsset | null> {
  if (!path) return null
  try {
    const asset = await BuildingInvoiceProfileRepository.downloadAsset(event, path)
    if (!ALLOWED_IMAGE_TYPES.has(asset.contentType) || asset.data.byteLength > MAX_IMAGE_BYTES) {
      return null
    }
    const contentType = asset.contentType as InvoiceDocumentImageAsset['contentType']
    return {
      data: asset.data,
      contentType,
      filename: `${filename}.${extensionFor(contentType)}`,
      cid,
    }
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
      qrImage: await downloadOptionalAsset(
        event,
        data.paymentProfile?.qrImagePath ?? null,
        `hoa-don-${data.invoiceCode}-qr`,
        'invoice-payment-qr',
      ),
      logoImage: await downloadOptionalAsset(
        event,
        data.paymentProfile?.logoImagePath ?? null,
        `hoa-don-${data.invoiceCode}-logo`,
        'invoice-building-logo',
      ),
    }
  },
}
