import { beforeEach, describe, expect, it, vi } from 'vitest'

interface MatchMediaController {
  query: MediaQueryList
  emit(matches: boolean): void
}

function mockMatchMedia(matches: boolean): MatchMediaController {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const query = {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList

  vi.stubGlobal('matchMedia', vi.fn(() => query))

  return {
    query,
    emit(nextMatches) {
      Object.defineProperty(query, 'matches', { configurable: true, value: nextMatches })
      for (const listener of listeners) listener({ matches: nextMatches } as MediaQueryListEvent)
    },
  }
}

describe('useDashboardTheme', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-dashboard-theme')
    document.documentElement.style.removeProperty('color-scheme')
    document.querySelector('meta[name="theme-color"]')?.remove()
    window.history.replaceState({}, '', '/')
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('uses the operating-system preference when storage is empty', async () => {
    mockMatchMedia(false)
    const { useDashboardTheme } = await import('~/composables/useDashboardTheme')
    const theme = useDashboardTheme()

    theme.initialize()

    expect(theme.preference.value).toBe('system')
    expect(theme.resolvedTheme.value).toBe('light')
    expect(document.documentElement.dataset.dashboardTheme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('normalizes invalid storage values to system', async () => {
    window.localStorage.setItem('dashboard-theme-preference', 'sepia')
    mockMatchMedia(true)
    const { useDashboardTheme } = await import('~/composables/useDashboardTheme')
    const theme = useDashboardTheme()

    theme.initialize()

    expect(theme.preference.value).toBe('system')
    expect(theme.resolvedTheme.value).toBe('dark')
  })

  it('persists explicit choices and ignores later system changes', async () => {
    const media = mockMatchMedia(true)
    const { useDashboardTheme } = await import('~/composables/useDashboardTheme')
    const theme = useDashboardTheme()
    theme.initialize()

    theme.setPreference('light')
    media.emit(true)

    expect(window.localStorage.getItem('dashboard-theme-preference')).toBe('light')
    expect(theme.resolvedTheme.value).toBe('light')
    expect(document.documentElement.dataset.dashboardTheme).toBe('light')
  })

  it('reacts to system changes while the preference is system', async () => {
    const media = mockMatchMedia(false)
    const { useDashboardTheme } = await import('~/composables/useDashboardTheme')
    const theme = useDashboardTheme()
    theme.initialize()

    media.emit(true)

    expect(theme.resolvedTheme.value).toBe('dark')
    expect(document.documentElement.dataset.dashboardTheme).toBe('dark')
  })

  it('keeps an explicit choice active when localStorage writes fail', async () => {
    mockMatchMedia(true)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked')
    })
    const { useDashboardTheme } = await import('~/composables/useDashboardTheme')
    const theme = useDashboardTheme()
    theme.initialize()

    theme.setPreference('light')

    expect(theme.preference.value).toBe('light')
    expect(theme.resolvedTheme.value).toBe('light')
  })

  it('toggles to the opposite explicit theme', async () => {
    mockMatchMedia(true)
    const { useDashboardTheme } = await import('~/composables/useDashboardTheme')
    const theme = useDashboardTheme()
    theme.initialize()

    theme.toggleTheme()

    expect(theme.preference.value).toBe('light')
    expect(theme.resolvedTheme.value).toBe('light')
  })

  it('synchronizes browser chrome color and restores it on dispose', async () => {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = '#ffffff'
    document.head.append(meta)
    mockMatchMedia(true)
    const { useDashboardTheme } = await import('~/composables/useDashboardTheme')
    const theme = useDashboardTheme()

    theme.initialize()
    expect(meta.content).toBe('#242528')

    theme.setPreference('light')
    expect(meta.content).toBe('#FFFFFF')

    theme.dispose()
    expect(meta.content).toBe('#ffffff')
  })

  it('restores the pre-bootstrap browser color when leaving dashboard', async () => {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = '#ffffff'
    document.head.append(meta)
    window.history.replaceState({}, '', '/dashboard')
    mockMatchMedia(true)
    const { DASHBOARD_THEME_BOOTSTRAP_SCRIPT } = await import('~/utils/theme/dashboard-theme-bootstrap')
    Function(DASHBOARD_THEME_BOOTSTRAP_SCRIPT)()
    expect(meta.content).toBe('#242528')

    const { useDashboardTheme } = await import('~/composables/useDashboardTheme')
    const theme = useDashboardTheme()
    theme.initialize()
    theme.dispose()

    expect(meta.content).toBe('#ffffff')
    expect(meta.hasAttribute('data-dashboard-previous-content')).toBe(false)
  })

  it('removes document state and media listeners on dispose, then supports re-entry', async () => {
    const media = mockMatchMedia(false)
    const { useDashboardTheme } = await import('~/composables/useDashboardTheme')
    const theme = useDashboardTheme()
    theme.initialize()

    theme.dispose()

    expect(media.query.removeEventListener).toHaveBeenCalledOnce()
    expect(document.documentElement.hasAttribute('data-dashboard-theme')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('')

    theme.initialize()
    expect(media.query.addEventListener).toHaveBeenCalledTimes(2)
    expect(document.documentElement.dataset.dashboardTheme).toBe('light')
  })
})

describe('dashboard theme pre-paint bootstrap', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-dashboard-theme')
    document.documentElement.style.removeProperty('color-scheme')
    document.querySelector('meta[name="theme-color"]')?.remove()
    window.history.replaceState({}, '', '/')
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('applies a stored dashboard preference before app hydration', async () => {
    window.history.replaceState({}, '', '/dashboard/buildings')
    window.localStorage.setItem('dashboard-theme-preference', 'light')
    const { DASHBOARD_THEME_BOOTSTRAP_SCRIPT } = await import('~/utils/theme/dashboard-theme-bootstrap')

    Function(DASHBOARD_THEME_BOOTSTRAP_SCRIPT)()

    expect(document.documentElement.dataset.dashboardTheme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('does not apply dashboard theme state on non-dashboard routes', async () => {
    window.history.replaceState({}, '', '/login')
    window.localStorage.setItem('dashboard-theme-preference', 'light')
    const { DASHBOARD_THEME_BOOTSTRAP_SCRIPT } = await import('~/utils/theme/dashboard-theme-bootstrap')

    Function(DASHBOARD_THEME_BOOTSTRAP_SCRIPT)()

    expect(document.documentElement.hasAttribute('data-dashboard-theme')).toBe(false)
  })
})
