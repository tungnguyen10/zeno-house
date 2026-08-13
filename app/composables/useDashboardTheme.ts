import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

export type DashboardThemePreference = 'system' | 'light' | 'dark'
export type DashboardResolvedTheme = Exclude<DashboardThemePreference, 'system'>

export interface DashboardTheme {
  preference: Ref<DashboardThemePreference>
  resolvedTheme: ComputedRef<DashboardResolvedTheme>
  initialize(): void
  dispose(): void
  setPreference(value: DashboardThemePreference): void
  toggleTheme(): void
}

export const DASHBOARD_THEME_STORAGE_KEY = 'dashboard-theme-preference'
export const DASHBOARD_THEME_ATTRIBUTE = 'data-dashboard-theme'

const preference = ref<DashboardThemePreference>('system')
const systemPrefersDark = ref(true)
let initialized = false
let mediaQuery: MediaQueryList | null = null
let stopThemeWatch: (() => void) | null = null
let previousThemeColor: string | undefined

export function normalizeDashboardThemePreference(value: string | null): DashboardThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

export function resolveDashboardTheme(
  selected: DashboardThemePreference,
  prefersDark: boolean,
): DashboardResolvedTheme {
  return selected === 'system' ? (prefersDark ? 'dark' : 'light') : selected
}

function applyDocumentTheme(theme: DashboardResolvedTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute(DASHBOARD_THEME_ATTRIBUTE, theme)
  document.documentElement.style.colorScheme = theme
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (themeColor) themeColor.content = theme === 'light' ? '#FFFFFF' : '#242528'
}

function clearDocumentTheme() {
  if (typeof document === 'undefined') return
  document.documentElement.removeAttribute(DASHBOARD_THEME_ATTRIBUTE)
  document.documentElement.style.removeProperty('color-scheme')
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (themeColor && previousThemeColor !== undefined) themeColor.content = previousThemeColor
  themeColor?.removeAttribute('data-dashboard-previous-content')
  previousThemeColor = undefined
}

function onSystemThemeChange(event: MediaQueryListEvent) {
  systemPrefersDark.value = event.matches
}

export function useDashboardTheme(): DashboardTheme {
  const resolvedTheme = computed<DashboardResolvedTheme>(() =>
    resolveDashboardTheme(preference.value, systemPrefersDark.value),
  )

  function initialize() {
    if (initialized || typeof window === 'undefined') return

    initialized = true
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    previousThemeColor = themeColor?.getAttribute('data-dashboard-previous-content')
      ?? themeColor?.content
    try {
      preference.value = normalizeDashboardThemePreference(
        window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY),
      )
    } catch {
      preference.value = 'system'
    }

    mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null
    systemPrefersDark.value = mediaQuery?.matches ?? true
    mediaQuery?.addEventListener('change', onSystemThemeChange)
    stopThemeWatch = watch(resolvedTheme, applyDocumentTheme, { immediate: true, flush: 'sync' })
  }

  function dispose() {
    mediaQuery?.removeEventListener('change', onSystemThemeChange)
    mediaQuery = null
    stopThemeWatch?.()
    stopThemeWatch = null
    initialized = false
    clearDocumentTheme()
  }

  function setPreference(value: DashboardThemePreference) {
    preference.value = value
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, value)
    } catch {
      // Keep the explicit preference active for the current session.
    }
  }

  function toggleTheme() {
    setPreference(resolvedTheme.value === 'dark' ? 'light' : 'dark')
  }

  return { preference, resolvedTheme, initialize, dispose, setPreference, toggleTheme }
}
