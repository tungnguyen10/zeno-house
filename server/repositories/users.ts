import { db as serverSupabaseClient } from '../utils/db'
import type { H3Event } from 'h3'
import type { ManagedUser } from '~/types/users'
import type { UserRole } from '~/utils/constants/roles'
import type { UserUpdateInput } from '~/utils/validators/users'
import type { TenantOnboardingStage } from '~/utils/tenant-onboarding'
import type { AuthAccount } from '~/types/auth'
import { serverSupabaseClient as serverAuthClient } from '#supabase/server'

interface AuthUserLike {
  id: string
  email?: string | null
  app_metadata?: Record<string, unknown> | null
  user_metadata?: Record<string, unknown> | null
}

type UserRemoveResult = 'deleted' | 'deactivated'

function isDeleteBlockedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const value = error as { code?: unknown; status?: unknown; message?: unknown }
  const code = typeof value.code === 'string' ? value.code : null
  const status = typeof value.status === 'number' ? value.status : null
  const message = typeof value.message === 'string' ? value.message : ''
  if (code === 'unexpected_failure') return true
  if (status === 500 && /database error deleting user/i.test(message)) return true
  return false
}

function userName(user: AuthUserLike): string | null {
  const metadata = user.user_metadata ?? {}
  const value = metadata.full_name ?? metadata.name ?? metadata.display_name
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function mapManagedUser(user: AuthUserLike): ManagedUser {
  const createdBy = user.app_metadata?.created_by
  return {
    id: user.id,
    email: user.email ?? null,
    name: userName(user),
    role: (user.app_metadata?.role as UserRole) ?? null as unknown as UserRole,
    createdBy: typeof createdBy === 'string' ? createdBy : null,
  }
}

/**
 * Auth user management via the Supabase service role. All methods here MUST run
 * server-side only; the service-role client bypasses RLS.
 */
export const UserRepository = {
  async getAuthAccount(event: H3Event, id: string): Promise<AuthAccount | null> {
    const cache = event.context.__authAccounts ??= new Map()
    const existing = cache.get(id)
    if (existing) return existing

    const lookup = (async () => {
      const client = serverSupabaseClient(event)
      const { data, error } = await client.auth.admin.getUserById(id)
      if (error) {
        if (error.status === 404) return null
        throwDbError(error, 'users.getAuthAccount')
      }
      return data.user
        ? {
            id: data.user.id,
            email: data.user.email ?? null,
            emailConfirmed: Boolean(data.user.email_confirmed_at),
            role: (data.user.app_metadata?.role as UserRole | undefined) ?? null,
            tenantOnboardingStage: data.user.app_metadata?.tenant_onboarding === 'password_required'
              ? data.user.app_metadata.tenant_onboarding as TenantOnboardingStage
              : null,
          }
        : null
    })()
    cache.set(id, lookup)
    try {
      return await lookup
    }
    catch (error) {
      cache.delete(id)
      throw error
    }
  },

  async setAppRole(event: H3Event, id: string, role: UserRole, createdBy: string): Promise<void> {
    const client = serverSupabaseClient(event)
    const { data: current, error: getError } = await client.auth.admin.getUserById(id)
    if (getError || !current.user) throwDbError(getError ?? new Error('User not found'), 'users.setAppRole.get')
    const { error } = await client.auth.admin.updateUserById(id, {
      app_metadata: { ...current.user.app_metadata, role, created_by: createdBy },
    })
    if (error) throwDbError(error, 'users.setAppRole.update')
  },

  async clearAppRole(event: H3Event, id: string): Promise<void> {
    const client = serverSupabaseClient(event)
    const { data: current, error: getError } = await client.auth.admin.getUserById(id)
    if (getError || !current.user) throwDbError(getError ?? new Error('User not found'), 'users.clearAppRole.get')
    const metadata = { ...current.user.app_metadata }
    delete metadata.role
    delete metadata.created_by
    const { error } = await client.auth.admin.updateUserById(id, { app_metadata: metadata })
    if (error) throwDbError(error, 'users.clearAppRole.update')
  },

  async listByRoles(event: H3Event, roles: UserRole[]): Promise<ManagedUser[]> {
    const client = serverSupabaseClient(event)
    const wanted = new Set(roles)
    const users: ManagedUser[] = []
    let page = 1

    while (true) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 })
      if (error) throwDbError(error, 'users.listByRoles')

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
    const client = serverSupabaseClient(event)
    const { data, error } = await client.auth.admin.getUserById(id)
    if (error) {
      if (error.status === 404) return null
      throwDbError(error, 'users.getById')
    }
    return data.user ? mapManagedUser(data.user) : null
  },

  async create(
    event: H3Event,
    input: {
      email: string
      password: string
      full_name?: string
      role: UserRole
      created_by?: string | null
      tenant_onboarding?: TenantOnboardingStage
    },
  ): Promise<ManagedUser> {
    const client = serverSupabaseClient(event)
    const { data, error } = await client.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: {
        role: input.role,
        created_by: input.created_by ?? null,
        ...(input.tenant_onboarding ? { tenant_onboarding: input.tenant_onboarding } : {}),
      },
      user_metadata: input.full_name ? { full_name: input.full_name } : {},
    })

    if (error) {
      // Supabase returns 422 for an already-registered email.
      if (error.status === 422 || error.code === 'email_exists') {
        throwConflict('Email đã được sử dụng')
      }
      throwDbError(error, 'users.create')
    }

    return mapManagedUser(data.user)
  },

  async setTenantOnboardingStage(
    event: H3Event,
    id: string,
    stage: TenantOnboardingStage | null,
  ): Promise<void> {
    const client = serverSupabaseClient(event)
    const { data: current, error: getError } = await client.auth.admin.getUserById(id)
    if (getError || !current.user) throwDbError(getError ?? new Error('User not found'), 'users.setTenantOnboardingStage.get')

    const metadata = { ...current.user.app_metadata }
    if (stage) metadata.tenant_onboarding = stage
    // Supabase merges app_metadata on update; omitting a key leaves the stored
    // value untouched. Null explicitly clears the onboarding gate in new JWTs.
    else metadata.tenant_onboarding = null

    const { error } = await client.auth.admin.updateUserById(id, { app_metadata: metadata })
    if (error) throwDbError(error, 'users.setTenantOnboardingStage.update')
  },

  async updateCurrentPassword(event: H3Event, password: string): Promise<void> {
    const client = await serverAuthClient(event)
    const { error } = await client.auth.updateUser({ password })
    if (error?.code === 'same_password') {
      throwValidationError('Mật khẩu mới phải khác mật khẩu hiện tại')
    }
    if (error) throwDbError(error, 'users.updateCurrentPassword')
  },

  async update(event: H3Event, id: string, input: UserUpdateInput): Promise<ManagedUser> {
    const client = serverSupabaseClient(event)
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
      throwDbError(error, 'users.update')
    }

    return mapManagedUser(data.user)
  },

  async remove(event: H3Event, id: string): Promise<UserRemoveResult> {
    const client = serverSupabaseClient(event)
    const { error } = await client.auth.admin.deleteUser(id)
    if (!error) return 'deleted'

    if (!isDeleteBlockedError(error)) {
      throwDbError(error, 'users.remove')
    }

    // Some auth users are referenced by historical/audit rows that intentionally
    // preserve actor identity. In those cases, hard delete fails; deprovision the
    // account so it can no longer access the app while references stay intact.
    await UserRepository.clearAppRole(event, id)
    const { error: deactivateError } = await client.auth.admin.updateUserById(id, {
      ban_duration: '876000h',
    })
    if (deactivateError) throwDbError(deactivateError, 'users.remove.deactivate')
    return 'deactivated'
  },
}
