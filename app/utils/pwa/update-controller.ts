interface UpdateControllerOptions {
  isBlocked: () => boolean
  activate: () => Promise<void>
  reload: () => void
}

/** Controller changes can originate in another tab; that is never consent to reload this tab. */
export function createPwaUpdateController(options: UpdateControllerOptions) {
  let activated = false
  let requestedHere = false
  let waiting = false
  let waitingVersion: object | undefined

  async function apply(): Promise<boolean> {
    if (options.isBlocked()) return false
    if (activated) { options.reload(); return true }
    requestedHere = true
    try { await options.activate(); return true }
    catch (error) { requestedHere = false; throw error }
  }

  function onActivated() {
    activated = true
    waiting = false
    const mayReload = requestedHere && !options.isBlocked()
    requestedHere = false
    if (mayReload) options.reload()
  }

  function onWaiting(version?: object): boolean {
    if (version ? version === waitingVersion : waiting) return false
    waiting = true
    waitingVersion = version
    activated = false
    requestedHere = false
    return true
  }

  return { apply, onActivated, onWaiting }
}

/** Workbox's isUpdate is fixed at initial registration; native changes cover long-lived first visits. */
export function observePwaControllerChanges(
  container: Pick<ServiceWorkerContainer, 'controller' | 'addEventListener' | 'removeEventListener'>,
  onUpdate: () => void,
) {
  let previous = container.controller
  const onChange = () => {
    const current = container.controller
    const isReplacement = Boolean(previous && current && previous !== current)
    previous = current
    if (isReplacement) onUpdate()
  }
  container.addEventListener('controllerchange', onChange)
  return () => container.removeEventListener('controllerchange', onChange)
}

/** Include uploads and confirmation actions outside forms; ignore the update button itself. */
export function hasPendingPwaWork(root: ParentNode): boolean {
  return Array.from(root.querySelectorAll('.portal-shell [aria-busy="true"], form [aria-busy="true"]'))
    .some(element => !element.closest('[data-pwa-update-host]'))
}
