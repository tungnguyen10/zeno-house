import type { H3Event } from 'h3'
import { db } from '../../utils/db'

const TENANT_DOCUMENT_BUCKET = 'tenant-documents'
const SIGNED_URL_TTL_SECONDS = 5 * 60

export interface TenantDocumentObject {
  id: string
  path: string
  name: string
  mimeType: string
  size: number
  createdAt: string
}

function storage(event: H3Event) {
  return db(event).storage.from(TENANT_DOCUMENT_BUCKET)
}

export const TenantDocumentRepository = {
  async list(event: H3Event, tenantId: string): Promise<TenantDocumentObject[]> {
    const { data, error } = await storage(event).list(tenantId, {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    if (error) throwDbError(error, 'tenantPortal.documents.list')

    return (data ?? []).flatMap((item) => {
      if (!item.id || !item.created_at || !item.metadata) return []
      return [{
        id: item.id,
        path: `${tenantId}/${item.name}`,
        name: typeof item.metadata.originalName === 'string'
          ? item.metadata.originalName
          : item.name,
        mimeType: item.metadata.mimetype,
        size: item.metadata.size,
        createdAt: item.created_at,
      }]
    })
  },

  async upload(
    event: H3Event,
    path: string,
    file: { name: string; mimeType: string; data: Buffer },
  ): Promise<{ id: string; path: string }> {
    const { data, error } = await storage(event).upload(path, file.data, {
      contentType: file.mimeType,
      metadata: { originalName: file.name },
      upsert: false,
    })
    if (error) throwDbError(error, 'tenantPortal.documents.upload')
    if (!data?.id) throwInternal(new Error('Storage upload did not return an object id'), 'tenantPortal.documents.upload')
    return { id: data.id, path: data.path }
  },

  async createSignedUrl(event: H3Event, path: string): Promise<string> {
    const { data, error } = await storage(event).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (error) throwDbError(error, 'tenantPortal.documents.createSignedUrl')
    return data.signedUrl
  },

  async remove(event: H3Event, path: string): Promise<void> {
    const { error } = await storage(event).remove([path])
    if (error) throwDbError(error, 'tenantPortal.documents.remove')
  },
}
