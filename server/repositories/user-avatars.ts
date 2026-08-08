import type { H3Event } from 'h3'
import { db } from '../utils/db'

const USER_AVATAR_BUCKET = 'user-avatars'
const SIGNED_URL_TTL_SECONDS = 5 * 60

function storage(event: H3Event) {
  return db(event).storage.from(USER_AVATAR_BUCKET)
}

export const UserAvatarRepository = {
  async upload(event: H3Event, path: string, file: { mimeType: string; data: Buffer }): Promise<string> {
    const { data, error } = await storage(event).upload(path, file.data, {
      contentType: file.mimeType,
      upsert: false,
    })
    if (error) throwDbError(error, 'userAvatars.upload')
    return data.path
  },

  async remove(event: H3Event, path: string): Promise<void> {
    const { error } = await storage(event).remove([path])
    if (error) throwDbError(error, 'userAvatars.remove')
  },

  async createSignedUrl(event: H3Event, path: string): Promise<string> {
    const { data, error } = await storage(event).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (error) throwDbError(error, 'userAvatars.createSignedUrl')
    return data.signedUrl
  },
}
