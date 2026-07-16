import type { H3Event } from 'h3'
import type { TenantIdentityImageSide } from '~/utils/validators/tenant-portal'
import { db } from '../../utils/db'

const IDENTITY_BUCKET = 'tenant-id-images'
const SIGNED_URL_TTL_SECONDS = 5 * 60
const PATHS_SELECT = 'id_card_front_path, id_card_back_path'

export interface TenantIdentityImagePaths {
  frontPath: string | null
  backPath: string | null
}

function mapPaths(row: {
  id_card_front_path: string | null
  id_card_back_path: string | null
}): TenantIdentityImagePaths {
  return {
    frontPath: row.id_card_front_path,
    backPath: row.id_card_back_path,
  }
}

function storage(event: H3Event) {
  return db(event).storage.from(IDENTITY_BUCKET)
}

export const TenantIdentityImageRepository = {
  async findPaths(event: H3Event, tenantId: string): Promise<TenantIdentityImagePaths | null> {
    const { data, error } = await db(event)
      .from('tenants')
      .select(PATHS_SELECT)
      .eq('id', tenantId)
      .maybeSingle()
    if (error) throwDbError(error, 'tenantPortal.identityImages.findPaths')
    return data ? mapPaths(data) : null
  },

  async updatePath(
    event: H3Event,
    tenantId: string,
    side: TenantIdentityImageSide,
    path: string | null,
  ): Promise<TenantIdentityImagePaths> {
    const payload = side === 'front'
      ? { id_card_front_path: path }
      : { id_card_back_path: path }
    const { data, error } = await db(event)
      .from('tenants')
      .update(payload)
      .eq('id', tenantId)
      .select(PATHS_SELECT)
      .single()
    if (error) throwDbError(error, 'tenantPortal.identityImages.updatePath')
    return mapPaths(data)
  },

  async upload(
    event: H3Event,
    path: string,
    file: { mimeType: string; data: Buffer },
  ): Promise<string> {
    const { data, error } = await storage(event).upload(path, file.data, {
      contentType: file.mimeType,
      upsert: false,
    })
    if (error) throwDbError(error, 'tenantPortal.identityImages.upload')
    return data.path
  },

  async remove(event: H3Event, path: string): Promise<void> {
    const { error } = await storage(event).remove([path])
    if (error) throwDbError(error, 'tenantPortal.identityImages.remove')
  },

  async createSignedUrl(event: H3Event, path: string): Promise<string> {
    const { data, error } = await storage(event).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (error) throwDbError(error, 'tenantPortal.identityImages.createSignedUrl')
    return data.signedUrl
  },
}
