import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('usePortalChartTheme', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="portal-shell"></div>'
    window.localStorage.clear()
    vi.resetModules()
  })

  it('resolves existing portal variables into concrete chart colors', async () => {
    vi.stubGlobal('getComputedStyle', vi.fn(() => ({
      getPropertyValue: (name: string) => ({
        '--portal-accent': '#0d9488',
        '--portal-accent-soft': '#e6fffa',
        '--portal-positive': '#10b981',
        '--portal-border': '#dbe7e8',
        '--portal-surface-deep': '#e2e8f0',
        '--portal-title': '#102a43',
        '--portal-body': '#475569',
        '--portal-muted': '#64748b',
      }[name] ?? ''),
    })))

    const { usePortalChartTheme } = await import(
      '~/composables/tenant-portal/usePortalChartTheme'
    )
    const theme = usePortalChartTheme()
    theme.refresh()

    expect(theme.palette.value).toEqual({
      accent: '#0d9488',
      accentSoft: '#e6fffa',
      positive: '#10b981',
      border: '#dbe7e8',
      surfaceDeep: '#e2e8f0',
      title: '#102a43',
      body: '#475569',
      muted: '#64748b',
    })
  })

  it('disables animation for reduced motion', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
    })))

    const { usePortalChartTheme } = await import(
      '~/composables/tenant-portal/usePortalChartTheme'
    )

    expect(usePortalChartTheme().animationDuration.value).toBe(0)
  })
})
