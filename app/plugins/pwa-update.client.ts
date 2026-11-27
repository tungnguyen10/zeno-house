import { registerSW } from 'virtual:pwa-register'
import { createPwaUpdateController, hasPendingPwaWork, observePwaControllerChanges } from '~/utils/pwa/update-controller'

export default defineNuxtPlugin((nuxtApp) => {
  const ready = useState<boolean>('pwa-update-ready', () => false)
  const updating = useState<boolean>('pwa-updating', () => false)
  const error = useState<string | null>('pwa-update-error', () => null)
  const sequence = useState<number>('pwa-update-sequence', () => 0)
  const portalDirty = useState<boolean>('portal-form-dirty', () => false)
  const otherFormDirty = useState<boolean>('pwa-other-form-dirty', () => false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let registration: ServiceWorkerRegistration | undefined
  let announcedWorker: ServiceWorker | null = null
  const registrationCleanup: Array<() => void> = []

  function announceWaiting(worker: ServiceWorker) {
    if (!controller.onWaiting(worker)) return
    announcedWorker = worker
    sequence.value += 1
    ready.value = true
    error.value = null
  }

  function checkWaiting() {
    if (registration?.waiting) announceWaiting(registration.waiting)
  }

  function observeRegistration(value: ServiceWorkerRegistration) {
    const observed = new WeakSet<ServiceWorker>()
    const trackInstalling = () => {
      const worker = value.installing
      if (!worker || observed.has(worker)) return
      observed.add(worker)
      const onStateChange = () => {
        if (worker.state === 'installed' && value.active) announceWaiting(worker)
        if (worker.state === 'activated' || worker.state === 'redundant') worker.removeEventListener('statechange', onStateChange)
      }
      worker.addEventListener('statechange', onStateChange)
      registrationCleanup.push(() => worker.removeEventListener('statechange', onStateChange))
      onStateChange()
    }
    value.addEventListener('updatefound', trackInstalling)
    registrationCleanup.push(() => value.removeEventListener('updatefound', trackInstalling))
    trackInstalling()
    checkWaiting()
  }

  const isBlocked = () => !navigator.onLine || portalDirty.value || otherFormDirty.value
    || hasPendingPwaWork(document)

  const controller = createPwaUpdateController({
    isBlocked,
    activate: () => updateServiceWorker(true),
    reload: () => window.location.reload(),
  })

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh: checkWaiting,
    // Suppress Workbox's automatic reload. Native controller changes below also
    // cover a first-visit tab that stays open until a later application update.
    onNeedReload() {},
    onRegisteredSW(_url, value) {
      registration = value
      if (value) observeRegistration(value)
    },
    onRegisterError() { error.value = 'Chưa kiểm tra được bản cập nhật. Bạn vẫn có thể sử dụng ứng dụng khi có mạng.' },
  })

  const stopWatchingController = navigator.serviceWorker
    ? observePwaControllerChanges(navigator.serviceWorker, () => {
        if (timer) clearTimeout(timer)
        const current = navigator.serviceWorker.controller
        if (current && current !== announcedWorker) {
          announcedWorker = current
          sequence.value += 1
        }
        ready.value = true
        updating.value = false
        controller.onActivated()
      })
    : () => {}
  if (import.meta.hot) import.meta.hot.dispose(() => {
    stopWatchingController()
    registrationCleanup.forEach(cleanup => cleanup())
    if (timer) clearTimeout(timer)
  })

  // Portal forms publish their own dirty state. Other product surfaces stay conservative.
  document.addEventListener('input', (event) => {
    if (window.location.pathname.startsWith('/portal')) return
    if (event.target instanceof HTMLElement && event.target.closest('form')) otherFormDirty.value = true
  }, { capture: true })
  nuxtApp.hook('page:finish', () => { otherFormDirty.value = false })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) void registration?.update().catch(() => {})
  })

  async function applyUpdate() {
    if (updating.value) return
    error.value = null
    if (isBlocked()) {
      error.value = !navigator.onLine
        ? 'Cần kết nối mạng để cập nhật.'
        : 'Hãy lưu hoặc bỏ thay đổi đang nhập, rồi cập nhật.'
      return
    }
    updating.value = true
    try {
      const accepted = await controller.apply()
      if (!accepted) { updating.value = false; return }
      if (!updating.value) return
      timer = setTimeout(() => {
        updating.value = false
        error.value = 'Bản cập nhật chưa sẵn sàng. Bạn có thể thử lại sau.'
      }, 12_000)
    }
    catch {
      updating.value = false
      error.value = 'Chưa cập nhật được. Hãy kiểm tra kết nối và thử lại.'
    }
  }

  return { provide: { pwaUpdate: { apply: applyUpdate } } }
})
