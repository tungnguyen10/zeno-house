import type { PendingOperation } from '~/types/dashboard'

export const PENDING_OPERATION_LABEL: Record<PendingOperation['type'], string> = {
  missing_readings: 'Chưa chốt số',
  unissued_invoices: 'Chưa phát hành',
  overdue_invoices: 'Quá hạn',
}

export const PENDING_OPERATION_SEVERITY_DOT_CLASS: Record<PendingOperation['severity'], string> = {
  danger: 'bg-error-vivid shadow-[0_0_0_3px_rgba(255,69,58,0.15)]',
  warning: 'bg-warning shadow-[0_0_0_3px_rgba(255,181,57,0.15)]',
  info: 'bg-cyan shadow-[0_0_0_3px_rgba(0,229,255,0.15)]',
}

export function pendingOperationLabel(type: PendingOperation['type']): string {
  return PENDING_OPERATION_LABEL[type]
}

export function pendingOperationSeverityDotClass(severity: PendingOperation['severity']): string {
  return PENDING_OPERATION_SEVERITY_DOT_CLASS[severity]
}
