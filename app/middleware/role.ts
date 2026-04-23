import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()

  if (!user.value) {
    return navigateTo('/login')
  }

  const path = to.path

  // Determine required role from route prefix
  const isAdminRoute = path.startsWith('/admin')
  const isManagerRoute = path.startsWith('/manager')
  const isTenantRoute = path.startsWith('/tenant')

  if (!isAdminRoute && !isManagerRoute && !isTenantRoute) return

  const authStore = useAuthStore()
  const role = await authStore.fetchRole()

  if (isAdminRoute && role !== 'admin') {
    return navigateTo('/login')
  }

  if (isManagerRoute && role !== 'manager' && role !== 'admin') {
    return navigateTo('/login')
  }

  if (isTenantRoute && role !== 'tenant') {
    return navigateTo('/login')
  }
})
