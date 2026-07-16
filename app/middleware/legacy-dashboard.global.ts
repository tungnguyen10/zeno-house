import { getLegacyDashboardRedirect } from '~/utils/routes/namespace'

export default defineNuxtRouteMiddleware((to) => {
  const redirect = getLegacyDashboardRedirect(to.fullPath)
  if (redirect) return navigateTo(redirect, { replace: true, redirectCode: 301 })
})
