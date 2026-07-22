import { db as serverSupabaseClient } from '../utils/db'
import type { H3Event } from 'h3'
import type { ManagedUser } from '~/types/users'
import type { UserRole } from '~/utils/constants/roles'
import type { UserUpdateInput } from '~/utils/validators/users'
import type { TenantOnboardingStage } from '~/utils/tenant-onboarding'
import { serverSupabaseClient as serverAuthClient } from '#supabase/server'

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
  async getAuthAccount(event: H3Event, id: string): Promise<{
    id: string
    email: string | null
    emailConfirmed: boolean
    role: UserRole | null
    tenantOnboardingStage: TenantOnboardingStage | null
    tenantOnboardingEmail: string | null
    identities: Array<{ provider: string, identityData: Record<string, unknown> }>
  } | null> {
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
          tenantOnboardingStage: typeof data.user.app_metadata?.tenant_onboarding === 'string'
            && ['password_required', 'email_required', 'google_required'].includes(data.user.app_metadata.tenant_onboarding)
            ? data.user.app_metadata.tenant_onboarding as TenantOnboardingStage
            : null,
          tenantOnboardingEmail: typeof data.user.app_metadata?.tenant_onboarding_email === 'string'
            ? data.user.app_metadata.tenant_onboarding_email
            : null,
          identities: (data.user.identities ?? []).map(identity => ({
            provider: identity.provider,
            identityData: (identity.identity_data ?? {}) as Record<string, unknown>,
          })),
        }
      : null
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
    else delete metadata.tenant_onboarding

    const { error } = await client.auth.admin.updateUserById(id, { app_metadata: metadata })
    if (error) throwDbError(error, 'users.setTenantOnboardingStage.update')
  },

  async setTenantOnboardingEmail(
    event: H3Event,
    id: string,
    email: string | null,
  ): Promise<void> {
    const client = serverSupabaseClient(event)
    const { data: current, error: getError } = await client.auth.admin.getUserById(id)
    if (getError || !current.user) throwDbError(getError ?? new Error('User not found'), 'users.setTenantOnboardingEmail.get')

    const metadata = { ...current.user.app_metadata }
    if (email) metadata.tenant_onboarding_email = email
    else delete metadata.tenant_onboarding_email

    const { error } = await client.auth.admin.updateUserById(id, { app_metadata: metadata })
    if (error) throwDbError(error, 'users.setTenantOnboardingEmail.update')
  },

  async updateCurrentPassword(event: H3Event, password: string): Promise<void> {
    const client = await serverAuthClient(event)
    const { error } = await client.auth.updateUser({ password })
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

  async remove(event: H3Event, id: string): Promise<void> {
    const client = serverSupabaseClient(event)
    const { error } = await client.auth.admin.deleteUser(id)
    if (error) throwDbError(error, 'users.remove')
  },
}
