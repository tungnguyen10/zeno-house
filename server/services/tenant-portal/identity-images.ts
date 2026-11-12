import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { TenantIdentityImages } from '~/types/tenant-portal'
import type { TenantIdentityImageSide } from '~/utils/validators/tenant-portal'
import {
  TenantIdentityImageRepository,
  type TenantIdentityImagePaths,
} from '../../repositories/tenant-portal/identity-images'
import { throwForbidden, throwNotFound } from '../../utils/errors'
import { can } from '../../utils/permissions'
import { resolveTenantId } from '../../utils/scope'

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
    _side: TenantIdentityImageSide,
    _file: { mimeType: string; data: Buffer },
  ): Promise<TenantIdentityImages> {
    if (!can(user, 'tenant.documents.write')) throwForbidden('Không có quyền cập nhật ảnh định danh')
    await resolveTenantId(event, user)
    throwForbidden('Ảnh định danh do ban quản lý xác minh. Vui lòng gửi yêu cầu chỉnh sửa.')
  },

  async remove(
    event: H3Event,
    user: AuthUser,
    _side: TenantIdentityImageSide,
  ): Promise<TenantIdentityImages> {
    if (!can(user, 'tenant.documents.write')) throwForbidden('Không có quyền xóa ảnh định danh')
    await resolveTenantId(event, user)
    throwForbidden('Ảnh định danh do ban quản lý xác minh. Vui lòng gửi yêu cầu chỉnh sửa.')
  },
}
