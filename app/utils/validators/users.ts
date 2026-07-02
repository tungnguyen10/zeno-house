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
