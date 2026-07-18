import { createToastController, type ToastItem } from '~/utils/createToastController'

export type ToastSeverity = 'success' | 'danger' | 'info'
export type ToastMessage = ToastItem<ToastSeverity>

const DEFAULT_TIMEOUT = 4000

export function useToast() {
  const { toasts, push, dismiss, pause, resume } = createToastController<ToastSeverity>({
    stateKey: 'ui-toasts',
    timeout: DEFAULT_TIMEOUT,
  })

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
