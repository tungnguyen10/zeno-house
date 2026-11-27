import { isPortalDataKey, portalSessionIdentity } from '~/utils/tenant-portal/session'

export default defineNuxtPlugin((nuxtApp) => {
  const user = useSupabaseUser()
  // Also covers expiry, external sign-out and switching accounts in another tab.
  watch(() => portalSessionIdentity(user.value), (identity, previous) => {
    if (identity !== previous) nuxtApp.runWithContext(() => clearNuxtData(isPortalDataKey))
  }, { flush: 'sync' })
})
