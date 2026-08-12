import { AuditOperationService } from '../../../services/audit-operations'

export default defineEventHandler(async (event) => {
  const secret = useRuntimeConfig(event).invoiceEmailDispatchSecret
  if (!secret || getHeader(event, 'x-audit-reconcile-secret') !== secret) {
    throwForbidden('Không có quyền chạy bộ đối soát audit')
  }
  return { data: await AuditOperationService.reconcile(event) }
})
