export type ToastSeverity = 'success' | 'danger' | 'info'

export interface ToastMessage {
  id: number
  severity: ToastSeverity
  message: string
  remaining: number
  timer: ReturnType<typeof setTimeout> | null
}

const DEFAULT_TIMEOUT = 4000

export function useToast() {
  const toasts = useState<ToastMessage[]>('ui-toasts', () => [])

  function dismiss(id: number) {
    const toast = toasts.value.find(item => item.id === id)
    if (toast?.timer) clearTimeout(toast.timer)
    toasts.value = toasts.value.filter(item => item.id !== id)
  }

  function schedule(toast: ToastMessage) {
    if (toast.timer) clearTimeout(toast.timer)
    toast.timer = setTimeout(() => dismiss(toast.id), toast.remaining)
  }

  function push(severity: ToastSeverity, message: string) {
    const toast: ToastMessage = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      severity,
      message,
      remaining: DEFAULT_TIMEOUT,
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

  return {
    toasts,
    success: (message: string) => push('success', message),
    error: (message: string) => push('danger', message),
    info: (message: string) => push('info', message),
    dismiss,
    pause,
    resume,
  }
}
