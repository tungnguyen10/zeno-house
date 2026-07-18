/**
 * Headless toast queue/timer controller shared by the internal operational
 * toast (`useToast`) and the customer-facing portal toast (`usePortalToast`).
 *
 * Each surface keeps its own `useState` key, severity vocabulary, and timeout,
 * but the queueing, auto-dismiss, and pause/resume logic lives here so the two
 * surfaces cannot drift.
 */
export interface ToastItem<TSeverity extends string> {
  id: number
  severity: TSeverity
  message: string
  remaining: number
  timer: ReturnType<typeof setTimeout> | null
}

export interface ToastController<TSeverity extends string> {
  toasts: Ref<ToastItem<TSeverity>[]>
  push: (severity: TSeverity, message: string) => number
  dismiss: (id: number) => void
  pause: (id: number) => void
  resume: (id: number) => void
}

export function createToastController<TSeverity extends string>(options: {
  /** `useState` key — must be unique per surface so queues stay isolated. */
  stateKey: string
  /** Auto-dismiss delay in milliseconds. */
  timeout: number
}): ToastController<TSeverity> {
  const { stateKey, timeout } = options
  const toasts = useState<ToastItem<TSeverity>[]>(stateKey, () => [])

  function dismiss(id: number) {
    const toast = toasts.value.find(item => item.id === id)
    if (toast?.timer) clearTimeout(toast.timer)
    toasts.value = toasts.value.filter(item => item.id !== id)
  }

  function schedule(toast: ToastItem<TSeverity>) {
    if (toast.timer) clearTimeout(toast.timer)
    toast.timer = setTimeout(() => dismiss(toast.id), toast.remaining)
  }

  function push(severity: TSeverity, message: string) {
    const toast: ToastItem<TSeverity> = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      severity,
      message,
      remaining: timeout,
      timer: null,
    }
    toasts.value = [...toasts.value, toast]
    if (import.meta.client) schedule(toast)
    return toast.id
  }

  function pause(id: number) {
    const toast = toasts.value.find(item => item.id === id)
    if (!toast?.timer) return
    clearTimeout(toast.timer)
    toast.timer = null
  }

  function resume(id: number) {
    const toast = toasts.value.find(item => item.id === id)
    if (!toast || toast.timer) return
    schedule(toast)
  }

  return { toasts, push, dismiss, pause, resume }
}
