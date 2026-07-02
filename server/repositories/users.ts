import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Database } from '~/types/database.types'
import type { ManagedUser } from '~/types/users'
import type { UserRole } from '~/utils/constants/roles'
import type { UserUpdateInput } from '~/utils/validators/users'

interface AuthUserLike {
  id: string
  email?: string | null
  app_metadata?: Record<string, unknown> | null
  user_metadata?: Record<string, unknown> | null
}

function userName(user: AuthUserLike): string | null {
  const metadata = user.user_metadata ?? {}
  const value = metadata.full_name ?? metadata.name ?? metadata.display_name
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function mapManagedUser(user: AuthUserLike): ManagedUser {
  return {
    id: user.id,
    email: user.email ?? null,
    name: userName(user),
    role: (user.app_metadata?.role as UserRole) ?? null as unknown as UserRole,
  }
}

/**
 * Auth user management via the Supabase service role. All methods here MUST run
 * server-side only; the service-role client bypasses RLS.
 */
export const UserRepository = {
  async listByRoles(event: H3Event, roles: UserRole[]): Promise<ManagedUser[]> {
    const client = serverSupabaseServiceRole<Database>(event)
    const wanted = new Set(roles)
    const users: ManagedUser[] = []
    let page = 1

    while (true) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 })
      if (error) throw createError({ statusCode: 500, message: error.message })

      for (const user of data.users) {
        const role = user.app_metadata?.role as UserRole | undefined
        if (!role || !wanted.has(role)) continue
        users.push(mapManagedUser(user))
      }

      if (data.users.length < 100) break
      page++
    }

    return users
  },

  async getById(event: H3Event, id: string): Promise<ManagedUser | null> {
    const client = serverSupabaseServiceRole<Database>(event)
    const { data, error } = await client.auth.admin.getUserById(id)
    if (error) {
      if (error.status === 404) return null
      throw createError({ statusCode: 500, message: error.message })
    }
    return data.user ? mapManagedUser(data.user) : null
  },

  async create(
    event: H3Event,
    input: { email: string; password: string; full_name?: string; role: UserRole },
  ): Promise<ManagedUser> {
    const client = serverSupabaseServiceRole<Database>(event)
    const { data, error } = await client.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: { role: input.role },
      user_metadata: input.full_name ? { full_name: input.full_name } : {},
    })

    if (error) {
      // Supabase returns 422 for an already-registered email.
      if (error.status === 422 || error.code === 'email_exists') {
        throwConflict('Email đã được sử dụng')
      }
      throw createError({ statusCode: 500, message: error.message })
    }

    return mapManagedUser(data.user)
  },

  async update(event: H3Event, id: string, input: UserUpdateInput): Promise<ManagedUser> {
    const client = serverSupabaseServiceRole<Database>(event)
    const attributes: {
      email?: string
      password?: string
      app_metadata?: { role: UserRole }
      user_metadata?: { full_name: string }
    } = {}

    if (input.email !== undefined) attributes.email = input.email
    if (input.password !== undefined) attributes.password = input.password
    if (input.role !== undefined) attributes.app_metadata = { role: input.role }
    if (input.full_name !== undefined) attributes.user_metadata = { full_name: input.full_name }

    const { data, error } = await client.auth.admin.updateUserById(id, attributes)

    if (error) {
      if (error.status === 404) throwNotFound('Không tìm thấy người dùng')
      if (error.status === 422 || error.code === 'email_exists') {
        throwConflict('Email đã được sử dụng')
      }
      throw createError({ statusCode: 500, message: error.message })
    }

    return mapManagedUser(data.user)
  },

  async remove(event: H3Event, id: string): Promise<void> {
    const client = serverSupabaseServiceRole<Database>(event)
    const { error } = await client.auth.admin.deleteUser(id)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },
}
