export const DASHBOARD_THEME_BOOTSTRAP_SCRIPT = `;(() => {
  if (!/^\\/dashboard(?:\\/|$)/.test(window.location.pathname)) return

  let preference = 'system'
  try {
    const stored = window.localStorage.getItem('dashboard-theme-preference')
    if (stored === 'light' || stored === 'dark' || stored === 'system') preference = stored
  } catch {}

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
  const resolved = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference
  document.documentElement.setAttribute('data-dashboard-theme', resolved)
  document.documentElement.style.colorScheme = resolved
  const themeColor = document.querySelector('meta[name="theme-color"]')
  if (themeColor) {
    if (!themeColor.hasAttribute('data-dashboard-previous-content')) {
      themeColor.setAttribute('data-dashboard-previous-content', themeColor.getAttribute('content') || '')
    }
    themeColor.setAttribute('content', resolved === 'light' ? '#FFFFFF' : '#242528')
  }
})()`
