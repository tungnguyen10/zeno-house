import { detectPwaInstallEnvironment } from '~/utils/pwa/install-environment'

/**
 * PWA install orchestration for the whole app (offered app-wide; the role
 * redirect decides the landing surface). Captures `beforeinstallprompt` on
 * supporting platforms, exposes standalone/iOS detection, and never shows a
 * prompt on first paint or while already installed.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePortalInstall() {
  const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
  const canPrompt = ref(false)
  const isStandalone = ref(false)
  const isAppleMobile = ref(false)
  const isSafari = ref(false)
  // Persist dismissal for the session so the prompt does not nag on every page.
  const dismissed = useState('portal-install-dismissed', () => false)

  function detectStandalone(): boolean {
    if (!import.meta.client) return false
    return (
      window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true
    )
  }

  function onBeforeInstallPrompt(event: Event) {
    event.preventDefault()
    deferredPrompt.value = event as BeforeInstallPromptEvent
    canPrompt.value = true
  }

  function onInstalled() {
    deferredPrompt.value = null
    canPrompt.value = false
    isStandalone.value = true
  }

  onMounted(() => {
    isStandalone.value = detectStandalone()
    const environment = detectPwaInstallEnvironment(window.navigator)
    isAppleMobile.value = environment.isAppleMobile
    isSafari.value = environment.isSafari
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.removeEventListener('appinstalled', onInstalled)
  })

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferredPrompt.value) return 'unavailable'
    await deferredPrompt.value.prompt()
    const choice = await deferredPrompt.value.userChoice
    deferredPrompt.value = null
    canPrompt.value = false
    return choice.outcome
  }

  function dismiss() {
    dismissed.value = true
  }

  /** Android/desktop: a captured prompt exists, not installed, not dismissed. */
  const showInstallPrompt = computed(
    () => canPrompt.value && !isStandalone.value && !dismissed.value,
  )
  /** iOS never fires `beforeinstallprompt`; offer manual A2HS guidance instead. */
  const showIosGuide = computed(
    () => isAppleMobile.value && !isStandalone.value && !dismissed.value,
  )

  return {
    canPrompt,
    isStandalone,
    isAppleMobile,
    isSafari,
    dismissed,
    showInstallPrompt,
    showIosGuide,
    promptInstall,
    dismiss,
  }
}
