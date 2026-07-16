import type { H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import type { AuthUser } from '~/types/auth'
import type { TenantDocument } from '~/types/tenant-portal'
import {
  TENANT_DOCUMENT_MAX_BYTES,
  TENANT_DOCUMENT_MIME_TYPES,
  tenantDocumentUploadSchema,
} from '~/utils/validators/tenant-portal'
import {
  TenantDocumentRepository,
  type TenantDocumentObject,
} from '../../repositories/tenant-portal/documents'
import { throwForbidden, throwNotFound, throwValidationError } from '../../utils/errors'
import { can } from '../../utils/permissions'
import { resolveTenantId } from '../../utils/scope'

const EXTENSIONS: Record<(typeof TENANT_DOCUMENT_MIME_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

async function withSignedUrl(
  event: H3Event,
  document: TenantDocumentObject,
): Promise<TenantDocument> {
  return {
    id: document.id,
    name: document.name,
    mimeType: document.mimeType,
    size: document.size,
    createdAt: document.createdAt,
    signedUrl: await TenantDocumentRepository.createSignedUrl(event, document.path),
  }
}

function validateUpload(file: { name: string; mimeType: string; data: Buffer }) {
  if (!TENANT_DOCUMENT_MIME_TYPES.includes(
    file.mimeType as (typeof TENANT_DOCUMENT_MIME_TYPES)[number],
  )) {
    throwValidationError('Tài liệu phải là tệp jpeg, png, webp hoặc pdf')
  }
  if (file.data.length > TENANT_DOCUMENT_MAX_BYTES) {
    throwValidationError('Tài liệu không được vượt quá 5MB')
  }

  const result = tenantDocumentUploadSchema.safeParse({
    name: file.name,
    mimeType: file.mimeType,
    size: file.data.length,
  })
  if (!result.success) {
    throwValidationError('Tệp tài liệu không hợp lệ', result.error.flatten())
  }
  return result.data
}

export const TenantDocumentService = {
  async list(event: H3Event, user: AuthUser): Promise<TenantDocument[]> {
    if (!can(user, 'tenant.documents.read')) throwForbidden('Không có quyền xem tài liệu')
    const tenantId = await resolveTenantId(event, user)
    const documents = await TenantDocumentRepository.list(event, tenantId)
    return Promise.all(documents.map(document => withSignedUrl(event, document)))
  },

  async upload(
    event: H3Event,
    user: AuthUser,
    file: { name: string; mimeType: string; data: Buffer },
  ): Promise<TenantDocument> {
    if (!can(user, 'tenant.documents.write')) throwForbidden('Không có quyền tải tài liệu')
    const metadata = validateUpload(file)
    const tenantId = await resolveTenantId(event, user)
    const extension = EXTENSIONS[metadata.mimeType]
    const path = `${tenantId}/${randomUUID()}.${extension}`
    const uploaded = await TenantDocumentRepository.upload(event, path, {
      name: metadata.name,
      mimeType: metadata.mimeType,
      data: file.data,
    })

    return {
      id: uploaded.id,
      name: metadata.name,
      mimeType: metadata.mimeType,
      size: metadata.size,
      createdAt: new Date().toISOString(),
      signedUrl: await TenantDocumentRepository.createSignedUrl(event, uploaded.path),
    }
  },

  async remove(event: H3Event, user: AuthUser, id: string): Promise<void> {
    if (!can(user, 'tenant.documents.write')) throwForbidden('Không có quyền xóa tài liệu')
    const tenantId = await resolveTenantId(event, user)
    const documents = await TenantDocumentRepository.list(event, tenantId)
    const document = documents.find(item => item.id === id)
    if (!document) throwNotFound('Không tìm thấy tài liệu')
    await TenantDocumentRepository.remove(event, document.path)
  },
}
