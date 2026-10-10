import { createDashboardNavigationFeedback } from '~/utils/dashboard-navigation-feedback'

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const feedback = createDashboardNavigationFeedback()
  const scrollByEntry = new Map<number, number>()
  let activePosition: number | undefined = window.history.state?.position
  let source: HTMLElement | null = null
  let sourceId = 0
  let lastClick: { element: HTMLElement, at: number } | null = null
  let shouldRestoreScroll = false
  let stopScrollRestore: (() => void) | null = null

  function restoreScroll(main: HTMLElement, top: number) {
    stopScrollRestore?.()
    if (top === 0) {
      main.scrollTo({ top: 0 })
      return
    }
    let observer: ResizeObserver | null = null
    let timeout: ReturnType<typeof setTimeout> | null = null
    const finish = () => {
      observer?.disconnect()
      if (timeout) clearTimeout(timeout)
      main.removeEventListener('wheel', finish)
      main.removeEventListener('touchstart', finish)
      stopScrollRestore = null
    }
    stopScrollRestore = finish
    const attempt = () => {
      main.scrollTo({ top })
      if (main.scrollTop >= top - 1) finish()
    }
    observer = new ResizeObserver(attempt)
    observer.observe(main.firstElementChild instanceof HTMLElement ? main.firstElementChild : main)
    main.addEventListener('wheel', finish, { once: true })
    main.addEventListener('touchstart', finish, { once: true })
    timeout = setTimeout(finish, 3000)
    requestAnimationFrame(attempt)
  }

  watch(feedback.pending, (state) => {
    source?.removeAttribute('data-dashboard-navigation-pending')
    source?.removeAttribute('data-dashboard-navigation-spinner')
    if (!state || !source) {
      source = null
      return
    }
    source.setAttribute('data-dashboard-navigation-pending', '')
    if (state.spinner) source.setAttribute('data-dashboard-navigation-spinner', '')
  }, { flush: 'sync' })

  function start(element: HTMLElement, target: string, from: string) {
    const id = element.dataset.dashboardNavigationSource ?? `dashboard-nav-${++sourceId}`
    element.dataset.dashboardNavigationSource = id
    if (!feedback.begin(id, target, from)) return false
    source = element
    element.setAttribute('data-dashboard-navigation-pending', '')
    return true
  }

  function onClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (!(event.target instanceof Element)) return
    const anchor = event.target.closest<HTMLAnchorElement>('a[href]')
    if (!anchor) {
      const candidate = event.target.closest<HTMLElement>('button, [role="button"], tr')
      if (candidate && router.currentRoute.value.path.startsWith('/dashboard')) {
        if (candidate.dataset.dashboardNavigationPending !== undefined) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        lastClick = { element: candidate, at: Date.now() }
      }
      return
    }
    if (anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
    const target = new URL(anchor.href, window.location.href)
    if (target.origin !== window.location.origin || !target.pathname.startsWith('/dashboard')) return
    const from = router.currentRoute.value.fullPath
    if (!router.currentRoute.value.path.startsWith('/dashboard')) return
    if (from === target.pathname + target.search + target.hash) return
    if (!start(anchor, target.pathname + target.search + target.hash, from)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  document.addEventListener('click', onClick, true)

  router.beforeEach((to, from) => {
    if (from.path.startsWith('/dashboard') && activePosition !== undefined) {
      const main = document.getElementById('main-content')
      if (main) scrollByEntry.set(activePosition, main.scrollTop)
    }
    if (to.path.startsWith('/dashboard') && !feedback.pending.value) {
      const recent = lastClick && Date.now() - lastClick.at < 500 ? lastClick.element : null
      if (recent) start(recent, to.fullPath, from.fullPath)
    }
    lastClick = null
  })

  router.afterEach((to, _from, failure) => {
    if (failure) feedback.navigationFailed(to.fullPath)
    else {
      activePosition = window.history.state?.position
      if (to.redirectedFrom) feedback.redirected(to.redirectedFrom.fullPath, to.fullPath)
      if (to.path === _from.path) feedback.pageRendered(to.fullPath)
      else shouldRestoreScroll = true
    }
  })

  router.onError(() => feedback.clear())

  nuxtApp.hook('page:finish', () => {
    const route = router.currentRoute.value
    feedback.pageRendered(route.fullPath)
    if (!route.path.startsWith('/dashboard') || !shouldRestoreScroll) return
    shouldRestoreScroll = false
    const main = document.getElementById('main-content')
    if (!main) return
    const saved = activePosition === undefined ? undefined : scrollByEntry.get(activePosition)
    restoreScroll(main, saved ?? 0)
  })

  nuxtApp.hook('app:error', () => feedback.clear())
  nuxtApp.hook('app:beforeMount', () => {
    // Nuxt keeps the layout mounted across dashboard routes; release this listener
    // with the app rather than with an individual page.
    nuxtApp.vueApp.onUnmount(() => document.removeEventListener('click', onClick, true))
  })
})
