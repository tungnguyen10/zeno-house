import { beforeEach, describe, expect, it, vi } from 'vitest'

interface MatchMediaController {
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
    emit(nextMatches) {
      Object.defineProperty(query, 'matches', { configurable: true, value: nextMatches })
      for (const listener of listeners) listener({ matches: nextMatches } as MediaQueryListEvent)
    },
  }
}

describe('usePortalTheme', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  it('uses the system color scheme on first initialization', async () => {
    mockMatchMedia(false)
    const { usePortalTheme } = await import('~/composables/tenant-portal/usePortalTheme')
    const theme = usePortalTheme()
    theme.initialize()

    expect(theme.preference.value).toBe('system')
    expect(theme.resolvedTheme.value).toBe('light')
  })

  it('falls back to dark when browser color-scheme preference is unavailable', async () => {
    vi.stubGlobal('matchMedia', undefined)
    const { usePortalTheme } = await import('~/composables/tenant-portal/usePortalTheme')
    const theme = usePortalTheme()
    theme.initialize()

    expect(theme.resolvedTheme.value).toBe('dark')
  })

  it('persists an explicit preference and protects it from system updates', async () => {
    const media = mockMatchMedia(true)
    const { usePortalTheme } = await import('~/composables/tenant-portal/usePortalTheme')
    const theme = usePortalTheme()
    theme.initialize()
    theme.setPreference('light')

    expect(window.localStorage.getItem('portal-theme-preference')).toBe('light')
    expect(theme.resolvedTheme.value).toBe('light')

    media.emit(true)
    expect(theme.resolvedTheme.value).toBe('light')
  })
})
