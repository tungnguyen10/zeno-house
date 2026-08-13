import { beforeEach, describe, expect, it, vi } from 'vitest'

function mockMatchMedia(matches: boolean) {
  const query = {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList
  vi.stubGlobal('matchMedia', vi.fn(() => query))
}

describe('useChartTheme', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-dashboard-theme')
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('exposes the established dark palette by default', async () => {
    mockMatchMedia(true)
    const { useDashboardTheme } = await import('~/composables/useDashboardTheme')
    const theme = useDashboardTheme()
    theme.initialize()
    const { useChartTheme } = await import('~/composables/useChartTheme')

    const chartTheme = useChartTheme()

    expect(chartTheme.palette.value).toMatchObject({
      accent: '#00E5FF',
      success: '#32D74B',
      surface: '#1E1E1E',
      primary: '#FFFFFF',
    })
    expect(chartTheme.stackedAreaOptions.value.scales?.y?.ticks).toMatchObject({ color: '#98989D' })
  })

  it('reactively updates palette and options after switching to light', async () => {
    mockMatchMedia(true)
    const { useDashboardTheme } = await import('~/composables/useDashboardTheme')
    const theme = useDashboardTheme()
    theme.initialize()
    const { useChartTheme } = await import('~/composables/useChartTheme')
    const chartTheme = useChartTheme()

    theme.setPreference('light')

    expect(chartTheme.resolvedTheme.value).toBe('light')
    expect(chartTheme.palette.value).toMatchObject({
      accent: '#007C91',
      success: '#15803D',
      warning: '#9A5800',
      danger: '#B9333F',
      border: '#D5E0E8',
      surface: '#FFFFFF',
      primary: '#17212B',
      muted: '#5B6B7A',
    })
    expect(chartTheme.stackedAreaOptions.value.scales?.y?.ticks).toMatchObject({ color: '#5B6B7A' })
    expect(chartTheme.stackedAreaOptions.value.scales?.y?.grid).toMatchObject({ color: '#D5E0E8' })
  })
})
