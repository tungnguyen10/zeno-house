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

  return { user, isAuthenticated, role, isAdmin }
})
