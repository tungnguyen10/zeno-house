import { defineStore } from 'pinia'
import { ROLES } from '~/utils/constants/roles'
import type { UserRole } from '~/utils/constants/roles'

export const useAuthStore = defineStore('auth', () => {
  const user = useSupabaseUser()

  const isAuthenticated = computed(() => user.value !== null)

  const role = computed<UserRole | null>(
    () => (user.value?.app_metadata?.role as UserRole) ?? null,
  )

  const isAdmin = computed(() => role.value === ROLES.ADMIN)
  const isOwner = computed(() => role.value === ROLES.OWNER)
  const isManager = computed(() => role.value === ROLES.MANAGER)

  /** Roles that can access Settings user management (admin global, owner scoped). */
  const canManageUsers = computed(() => isAdmin.value || isOwner.value)
  /** Only admin can create owner accounts. */
  const canCreateOwner = computed(() => isAdmin.value)
  /**
   * Operational write authority for buildings and domain content. Admin is
   * global; owner is scoped (server enforces the building scope). Manager is
   * read-mostly and excluded here. Server remains authoritative — this only
   * drives UI visibility.
   */
  const canManage = computed(() => isAdmin.value || isOwner.value)

  return {
    user,
    isAuthenticated,
    role,
    isAdmin,
    isOwner,
    isManager,
    canManageUsers,
    canCreateOwner,
    canManage,
  }
})
