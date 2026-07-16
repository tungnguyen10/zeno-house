import type { H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import type { AuthUser } from '~/types/auth'
import type { TenantIdentityImages } from '~/types/tenant-portal'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import {
  TENANT_DOCUMENT_MAX_BYTES,
  TENANT_IDENTITY_IMAGE_MIME_TYPES,
  tenantIdentityImageUploadSchema,
  type TenantIdentityImageSide,
} from '~/utils/validators/tenant-portal'
import {
  TenantIdentityImageRepository,
  type TenantIdentityImagePaths,
} from '../../repositories/tenant-portal/identity-images'
import { throwForbidden, throwNotFound, throwValidationError } from '../../utils/errors'
import { can } from '../../utils/permissions'
import { resolveTenantId } from '../../utils/scope'
import { AuditService } from '../audit'

const EXTENSIONS: Record<(typeof TENANT_IDENTITY_IMAGE_MIME_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

async function signedImages(
  event: H3Event,
  paths: TenantIdentityImagePaths,
): Promise<TenantIdentityImages> {
  const [frontSignedUrl, backSignedUrl] = await Promise.all([
    paths.frontPath
      ? TenantIdentityImageRepository.createSignedUrl(event, paths.frontPath)
      : null,
    paths.backPath
      ? TenantIdentityImageRepository.createSignedUrl(event, paths.backPath)
      : null,
  ])
  return { frontSignedUrl, backSignedUrl }
}

function validateImage(file: { mimeType: string; data: Buffer }) {
  if (!TENANT_IDENTITY_IMAGE_MIME_TYPES.includes(
    file.mimeType as (typeof TENANT_IDENTITY_IMAGE_MIME_TYPES)[number],
  )) {
    throwValidationError('Ảnh định danh phải là jpeg, png hoặc webp')
  }
  if (file.data.length > TENANT_DOCUMENT_MAX_BYTES) {
    throwValidationError('Ảnh định danh không được vượt quá 5MB')
  }
  const result = tenantIdentityImageUploadSchema.safeParse({
    mimeType: file.mimeType,
    size: file.data.length,
  })
  if (!result.success) throwValidationError('Ảnh định danh không hợp lệ', result.error.flatten())
  return result.data
}

async function requirePaths(event: H3Event, tenantId: string) {
  const paths = await TenantIdentityImageRepository.findPaths(event, tenantId)
  if (!paths) throwNotFound('Không tìm thấy hồ sơ')
  return paths
}

export const TenantIdentityImageService = {
  async get(event: H3Event, user: AuthUser): Promise<TenantIdentityImages> {
    if (!can(user, 'tenant.documents.read')) throwForbidden('Không có quyền xem ảnh định danh')
    const tenantId = await resolveTenantId(event, user)
    return signedImages(event, await requirePaths(event, tenantId))
  },

  async upload(
    event: H3Event,
    user: AuthUser,
    side: TenantIdentityImageSide,
    file: { mimeType: string; data: Buffer },
  ): Promise<TenantIdentityImages> {
    if (!can(user, 'tenant.documents.write')) throwForbidden('Không có quyền cập nhật ảnh định danh')
    const metadata = validateImage(file)
    const tenantId = await resolveTenantId(event, user)
    const before = await requirePaths(event, tenantId)
    const path = `${tenantId}/${side}/${randomUUID()}.${EXTENSIONS[metadata.mimeType]}`
    const uploadedPath = await TenantIdentityImageRepository.upload(event, path, {
      mimeType: metadata.mimeType,
      data: file.data,
    })
    const after = await TenantIdentityImageRepository.updatePath(event, tenantId, side, uploadedPath)
    const previousPath = side === 'front' ? before.frontPath : before.backPath
    if (previousPath) await TenantIdentityImageRepository.remove(event, previousPath)

    await AuditService.append(event, user, {
      building_id: null,
      action: AUDIT_ACTIONS.TENANT_UPDATED,
      entity_type: 'tenant',
      entity_id: tenantId,
      before_data: before,
      after_data: after,
      metadata: { identity_image_side: side },
    })
    return signedImages(event, after)
  },

  async remove(
    event: H3Event,
    user: AuthUser,
    side: TenantIdentityImageSide,
  ): Promise<TenantIdentityImages> {
    if (!can(user, 'tenant.documents.write')) throwForbidden('Không có quyền xóa ảnh định danh')
    const tenantId = await resolveTenantId(event, user)
    const before = await requirePaths(event, tenantId)
    const previousPath = side === 'front' ? before.frontPath : before.backPath
    if (!previousPath) return signedImages(event, before)

    const after = await TenantIdentityImageRepository.updatePath(event, tenantId, side, null)
    await TenantIdentityImageRepository.remove(event, previousPath)
    await AuditService.append(event, user, {
      building_id: null,
      action: AUDIT_ACTIONS.TENANT_UPDATED,
      entity_type: 'tenant',
      entity_id: tenantId,
      before_data: before,
      after_data: after,
      metadata: { identity_image_side: side },
    })
    return signedImages(event, after)
  },
}
