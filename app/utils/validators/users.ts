import { z } from 'zod'
import { ROLES } from '~/utils/constants/roles'

/**
 * User creation payload for scoped user management.
 *
 * `role` accepts all known roles so that an attempt to create an `admin` reaches
 * the service and is rejected there with 403 (no role has `users.create.admin`),
 * matching the "app never creates admin" requirement. Unknown roles fail with 422.
 */
export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(72, 'Mật khẩu tối đa 72 ký tự'),
  full_name: z.string().trim().min(1, 'Tên không được để trống').max(120).optional(),
  role: z.enum([ROLES.ADMIN, ROLES.OWNER, ROLES.MANAGER]),
  building_ids: z.array(z.string().uuid('Tòa nhà không hợp lệ')).default([]),
})

export type UserCreateInput = z.infer<typeof userCreateSchema>

export const userUpdateSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ').optional(),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(72, 'Mật khẩu tối đa 72 ký tự').optional(),
  full_name: z.string().trim().max(120).optional(),
  role: z.enum([ROLES.ADMIN, ROLES.OWNER, ROLES.MANAGER]).optional(),
}).refine(
  value => Object.values(value).some(item => item !== undefined),
  { message: 'Cần cập nhật ít nhất một trường' },
)

export type UserUpdateInput = z.infer<typeof userUpdateSchema>

/** Self-service profile update — deliberately excludes `email`/`role`/`password`. */
export const userProfileUpdateSchema = z.object({
  full_name: z.string().trim().min(1, 'Tên không được để trống').max(120, 'Tên quá dài'),
})

export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>

const userPasswordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(72, 'Mật khẩu không được vượt quá 72 ký tự')

export const userPasswordChangeSchema = z.object({
  current_password: userPasswordSchema,
  password: userPasswordSchema,
  password_confirmation: userPasswordSchema,
}).superRefine((input, context) => {
  if (input.password !== input.password_confirmation) {
    context.addIssue({ code: 'custom', path: ['password_confirmation'], message: 'Mật khẩu xác nhận không khớp' })
  }
  if (input.password === input.current_password) {
    context.addIssue({ code: 'custom', path: ['password'], message: 'Mật khẩu mới phải khác mật khẩu hiện tại' })
  }
})

export type UserPasswordChangeInput = z.infer<typeof userPasswordChangeSchema>

export const USER_AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const USER_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const userAvatarUploadSchema = z.object({
  mimeType: z.enum(USER_AVATAR_MIME_TYPES),
  size: z.number().int().positive().max(USER_AVATAR_MAX_BYTES),
})

export type UserAvatarUploadMetadata = z.infer<typeof userAvatarUploadSchema>

