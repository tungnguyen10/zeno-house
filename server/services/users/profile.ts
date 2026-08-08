import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { UserProfile } from '~/types/users'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import type { USER_AVATAR_MIME_TYPES} from '~/utils/validators/users';
import { userAvatarUploadSchema } from '~/utils/validators/users'
import { UserRepository, type OwnProfile } from '../../repositories/users'
import { UserAvatarRepository } from '../../repositories/user-avatars'
import { throwForbidden, throwValidationError } from '../../utils/errors'
import { can } from '../../utils/permissions'
import { AuditService } from '../audit'

const EXTENSIONS: Record<(typeof USER_AVATAR_MIME_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function assertCanUpdateOwnProfile(user: AuthUser): void {
  if (!can(user, 'account.profile.update')) throwForbidden('Không có quyền cập nhật hồ sơ')
}

async function toProfileDto(event: H3Event, own: OwnProfile): Promise<UserProfile> {
  const avatarUrl = own.avatarPath
    ? await UserAvatarRepository.createSignedUrl(event, own.avatarPath)
    : own.googleAvatarUrl
  return {
    id: own.id,
    email: own.email,
    fullName: own.fullName,
    avatarUrl,
    hasCustomAvatar: own.avatarPath !== null,
    role: own.role,
  }
}

function validateAvatar(file: { mimeType: string; data: Buffer }) {
  const result = userAvatarUploadSchema.safeParse({ mimeType: file.mimeType, size: file.data.length })
  if (!result.success) {
    throwValidationError('Ảnh đại diện phải là JPEG, PNG hoặc WebP, tối đa 2MB', result.error.flatten())
  }
  return result.data
}

export const UserProfileService = {
  async get(event: H3Event, user: AuthUser): Promise<UserProfile> {
    assertCanUpdateOwnProfile(user)
    return toProfileDto(event, await UserRepository.getOwnProfile(event))
  },

  async updateFullName(event: H3Event, user: AuthUser, fullName: string): Promise<UserProfile> {
    assertCanUpdateOwnProfile(user)
    const before = await UserRepository.getOwnProfile(event)
    const after = await UserRepository.updateOwnFullName(event, fullName)

    await AuditService.append(event, user, {
      building_id: null,
      action: AUDIT_ACTIONS.USER_PROFILE_UPDATED,
      entity_type: 'user',
      entity_id: user.id,
      before_data: { fullName: before.fullName },
      after_data: { fullName: after.fullName },
    })
    return toProfileDto(event, after)
  },

  async uploadAvatar(
    event: H3Event,
    user: AuthUser,
    file: { mimeType: string, data: Buffer },
  ): Promise<UserProfile> {
    assertCanUpdateOwnProfile(user)
    const metadata = validateAvatar(file)
    const before = await UserRepository.getOwnProfile(event)
    const path = `${user.id}/${randomUUID()}.${EXTENSIONS[metadata.mimeType]}`
    const uploadedPath = await UserAvatarRepository.upload(event, path, {
      mimeType: metadata.mimeType,
      data: file.data,
    })
    const after = await UserRepository.updateOwnAvatarPath(event, uploadedPath)
    if (before.avatarPath) await UserAvatarRepository.remove(event, before.avatarPath)

    await AuditService.append(event, user, {
      building_id: null,
      action: AUDIT_ACTIONS.USER_PROFILE_UPDATED,
      entity_type: 'user',
      entity_id: user.id,
      metadata: { avatar_changed: true },
    })
    return toProfileDto(event, after)
  },

  async removeAvatar(event: H3Event, user: AuthUser): Promise<UserProfile> {
    assertCanUpdateOwnProfile(user)
    const before = await UserRepository.getOwnProfile(event)
    if (!before.avatarPath) return toProfileDto(event, before)

    const after = await UserRepository.updateOwnAvatarPath(event, null)
    await UserAvatarRepository.remove(event, before.avatarPath)

    await AuditService.append(event, user, {
      building_id: null,
      action: AUDIT_ACTIONS.USER_PROFILE_UPDATED,
      entity_type: 'user',
      entity_id: user.id,
      metadata: { avatar_removed: true },
    })
    return toProfileDto(event, after)
  },
}
