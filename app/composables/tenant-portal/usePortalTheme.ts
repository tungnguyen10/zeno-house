export type PortalThemePreference = 'system' | 'light' | 'dark'
export type PortalResolvedTheme = Exclude<PortalThemePreference, 'system'>

const STORAGE_KEY = 'portal-theme-preference'
const preference = ref<PortalThemePreference>('system')
const systemPrefersDark = ref(true)
let initialized = false
let mediaQuery: MediaQueryList | null = null

function preferenceFrom(value: string | null): PortalThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function updateSystemPreference(matches: boolean) {
  if (preference.value === 'system') systemPrefersDark.value = matches
}

export function usePortalTheme() {
  const resolvedTheme = computed<PortalResolvedTheme>(() => (
    preference.value === 'system'
      ? (systemPrefersDark.value ? 'dark' : 'light')
      : preference.value
  ))

  function initialize() {
    if (initialized || typeof window === 'undefined') return

    initialized = true
    try {
      preference.value = preferenceFrom(window.localStorage.getItem(STORAGE_KEY))
    } catch {
      preference.value = 'system'
    }

    mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null
    systemPrefersDark.value = mediaQuery?.matches ?? true
    mediaQuery?.addEventListener('change', event => updateSystemPreference(event.matches))
  }

  function setPreference(next: PortalThemePreference) {
    preference.value = next
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Theme choice remains active for the current session when storage is unavailable.
    }
  }

  function toggleTheme() {
    setPreference(resolvedTheme.value === 'dark' ? 'light' : 'dark')
  }

  return { preference, resolvedTheme, initialize, setPreference, toggleTheme }
}
