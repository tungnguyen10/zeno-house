import { createToastController, type ToastItem } from '~/utils/createToastController'

/**
 * Portal-scoped toast surface. Deliberately separate from the internal
 * `useToast`/`UiToastHost` (different `useState` key and host component) so the
 * customer-facing portal never renders the internal operational toast. Shares
 * the queue/timer logic via `createToastController`.
 */
export type PortalToastSeverity = 'success' | 'error' | 'info'
export type PortalToast = ToastItem<PortalToastSeverity>

const DEFAULT_TIMEOUT = 3500

export function usePortalToast() {
  const { toasts, push, dismiss } = createToastController<PortalToastSeverity>({
    stateKey: 'portal-toasts',
    timeout: DEFAULT_TIMEOUT,
  })

  return {
    toasts,
    dismiss,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message),
  }
}
