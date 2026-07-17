/**
 * Portal chrome (sticky header) state shared between the tenant layout header
 * and the active portal page. Pages declare their contextual title and whether
 * an in-app back affordance should be shown. The single primary action is
 * provided by pages via a `<Teleport to="#portal-header-action">`.
 */
export interface PortalChromeState {
  title: string
  /** Route to navigate back to, or `null` to hide the back affordance. */
  back: string | null
}

export function usePortalChrome() {
  const chrome = useState<PortalChromeState>('portal-chrome', () => ({
    title: 'Zeno House',
    back: null,
  }))

  function setChrome(next: Partial<PortalChromeState>) {
    chrome.value = { title: next.title ?? chrome.value.title, back: next.back ?? null }
  }

  return { chrome, setChrome }
}
