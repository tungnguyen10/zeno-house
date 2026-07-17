/**
 * Portal-scoped toast surface. Deliberately separate from the internal
 * `useToast`/`UiToastHost` (different `useState` key and host component) so the
 * customer-facing portal never renders the internal operational toast.
 */
export type PortalToastSeverity = 'success' | 'error' | 'info'

export interface PortalToast {
  id: number
  severity: PortalToastSeverity
  message: string
  timer: ReturnType<typeof setTimeout> | null
}

const DEFAULT_TIMEOUT = 3500

export function usePortalToast() {
  const toasts = useState<PortalToast[]>('portal-toasts', () => [])

  function dismiss(id: number) {
    const toast = toasts.value.find(item => item.id === id)
    if (toast?.timer) clearTimeout(toast.timer)
    toasts.value = toasts.value.filter(item => item.id !== id)
  }

  function push(severity: PortalToastSeverity, message: string) {
    const toast: PortalToast = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      severity,
      message,
      timer: null,
    }
    toasts.value = [...toasts.value, toast]
    if (import.meta.client) {
      toast.timer = setTimeout(() => dismiss(toast.id), DEFAULT_TIMEOUT)
    }
    return toast.id
  }

  return {
    toasts,
    dismiss,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message),
  }
}
