import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BuildingInvoiceProfile } from '~/types/building-invoice-profile'
import type { BuildingInvoiceProfileFieldsInput } from '~/utils/validators/building-invoice-profile'
import { mapBuildingInvoiceProfile } from '~/utils/mappers/building-invoice-profile'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { BuildingRepository } from '../../repositories/buildings'
import { BuildingInvoiceProfileRepository } from '../../repositories/building-invoice-profiles'
import { assertBuildingScope } from '../../utils/scope'
import { AuditService } from '../audit'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export interface InvoiceProfileImage {
  filename?: string
  type?: string
  data: Buffer
}

export interface SaveBuildingInvoiceProfile {
  fields: BuildingInvoiceProfileFieldsInput
  qrImage?: InvoiceProfileImage
  logoImage?: InvoiceProfileImage
  removeLogo: boolean
}

function validateImage(file: InvoiceProfileImage | undefined, label: string): void {
  if (!file) return
  if (!file.type || !IMAGE_TYPES.has(file.type)) {
    throwValidationError(`${label} phải có định dạng JPEG, PNG hoặc WebP`)
  }
  if (file.data.length > MAX_IMAGE_BYTES) {
    throwValidationError(`${label} không được vượt quá 5MB`)
  }
}

async function requireBuilding(event: H3Event, identifier: string) {
  const building = await BuildingRepository.findByIdentifier(event, identifier)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  return building
}

async function toDto(
  event: H3Event,
  row: Awaited<ReturnType<typeof BuildingInvoiceProfileRepository.findByBuildingId>>,
): Promise<BuildingInvoiceProfile | null> {
  if (!row) return null
  const [qrImageUrl, logoImageUrl] = await Promise.all([
    BuildingInvoiceProfileRepository.signAsset(event, row.qr_image_path),
    row.logo_image_path
      ? BuildingInvoiceProfileRepository.signAsset(event, row.logo_image_path)
      : Promise.resolve(null),
  ])
  return mapBuildingInvoiceProfile(row, { qrImageUrl, logoImageUrl })
}

export const BuildingInvoiceProfileService = {
  async get(
    event: H3Event,
    user: AuthUser,
    buildingIdentifier: string,
  ): Promise<BuildingInvoiceProfile | null> {
    if (!can(user, 'building-invoice-profile.read')) {
      throwForbidden('Không có quyền xem thông tin thanh toán của tòa nhà')
    }
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'read')
    return toDto(event, await BuildingInvoiceProfileRepository.findByBuildingId(event, building.id))
  },

  async save(
    event: H3Event,
    user: AuthUser,
    buildingIdentifier: string,
    input: SaveBuildingInvoiceProfile,
  ): Promise<BuildingInvoiceProfile> {
    if (!can(user, 'building-invoice-profile.write')) {
      throwForbidden('Không có quyền cập nhật thông tin thanh toán của tòa nhà')
    }
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'write')
    const existing = await BuildingInvoiceProfileRepository.findByBuildingId(event, building.id)
    if (!existing && !input.qrImage) {
      throwValidationError('Vui lòng tải ảnh QR ngân hàng khi cấu hình lần đầu')
    }
    validateImage(input.qrImage, 'Ảnh QR')
    validateImage(input.logoImage, 'Logo tòa nhà')

    const uploadedPaths: string[] = []
    let saved: Awaited<ReturnType<typeof BuildingInvoiceProfileRepository.saveWithLegacyBackfill>>
    try {
      const qrImagePath = input.qrImage
        ? await BuildingInvoiceProfileRepository.uploadAsset(event, building.id, 'qr', {
            type: input.qrImage.type!,
            data: input.qrImage.data,
          })
        : null
      if (qrImagePath) uploadedPaths.push(qrImagePath)

      const logoImagePath = input.logoImage
        ? await BuildingInvoiceProfileRepository.uploadAsset(event, building.id, 'logo', {
            type: input.logoImage.type!,
            data: input.logoImage.data,
          })
        : null
      if (logoImagePath) uploadedPaths.push(logoImagePath)

      saved = await BuildingInvoiceProfileRepository.saveWithLegacyBackfill(event, {
        buildingId: building.id,
        actorId: user.id!,
        bankName: input.fields.bank_name,
        accountHolder: input.fields.account_holder,
        accountNumber: input.fields.account_number,
        transferContentTemplate: input.fields.transfer_content_template,
        qrImagePath,
        logoImagePath,
        removeLogo: input.removeLogo,
      })

    }
    catch (error) {
      if (uploadedPaths.length > 0) {
        try {
          await BuildingInvoiceProfileRepository.removeAssets(event, uploadedPaths)
        }
        catch {
          // Preserve the original persistence error; cleanup is best-effort.
        }
      }
      throw error
    }

    await AuditService.append(event, user, {
      building_id: building.id,
      action: AUDIT_ACTIONS.BUILDING_INVOICE_PROFILE_UPDATED,
      entity_type: 'building',
      entity_id: building.id,
      metadata: {
        configured_first_time: !existing,
        backfilled_count: saved.backfilledCount,
        qr_replaced: Boolean(input.qrImage),
        logo_replaced: Boolean(input.logoImage),
        logo_removed: input.removeLogo,
      },
    })

    const dto = await toDto(event, saved.profile)
    if (!dto) throwInternal(new Error('Saved profile is missing'), 'buildingInvoiceProfile.save')
    return dto
  },
}
