export type AuditMetricName
  = | 'audit.append_failed'
    | 'audit.constraint_failed'
    | 'audit.operation_stale'
    | 'audit.reconciliation_failed'

export function reportAuditMetric(
  metric: AuditMetricName,
  fields: Record<string, unknown>,
): void {
  console.error('[AUDIT_TELEMETRY]', JSON.stringify({
    metric,
    occurredAt: new Date().toISOString(),
    ...fields,
  }))
}
