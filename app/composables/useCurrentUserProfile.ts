import type { ApiSuccess } from '~/types/api'
import type { UserProfile } from '~/types/users'

/** Shared display state for the current user: name/avatar from own profile (Google or uploaded) when available, else email/initial. */
export function useCurrentUserProfile() {
  const authStore = useAuthStore()
  // Shares the key with useUserProfile() so editing the profile updates the header/sidebar too.
  const { data } = useFetch<ApiSuccess<UserProfile>>('/api/users/me', { key: 'current-user-profile' })

  const userInitial = computed(() => {
    const email = authStore.user?.email ?? ''
    return email.charAt(0).toUpperCase() || 'U'
  })

  // Instant client-side fallback (no network wait) while the server profile loads.
  const clientDisplayName = computed(() => {
    const metadata = authStore.user?.user_metadata as Record<string, unknown> | undefined
    const name = metadata?.full_name ?? metadata?.name
    if (typeof name === 'string' && name.trim().length > 0) return name
    return authStore.user?.email ?? ''
  })

  const clientAvatarUrl = computed(() => {
    const metadata = authStore.user?.user_metadata as Record<string, unknown> | undefined
    const url = metadata?.avatar_url ?? metadata?.picture
    return typeof url === 'string' && url.length > 0 ? url : null
  })

  const displayName = computed(() => data.value?.data.fullName || clientDisplayName.value)
  const avatarUrl = computed(() => data.value?.data.avatarUrl ?? clientAvatarUrl.value)

  const avatarLoadError = ref(false)
  watch(avatarUrl, () => { avatarLoadError.value = false })

  const showAvatarImage = computed(() => avatarUrl.value !== null && !avatarLoadError.value)

  function onAvatarError() {
    avatarLoadError.value = true
  }

  return { userInitial, displayName, avatarUrl, showAvatarImage, onAvatarError }
}
