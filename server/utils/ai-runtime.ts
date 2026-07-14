import type { H3Event } from 'h3'

export interface AiRuntimePolicy {
  chatEnabled: boolean
  readToolsEnabled: boolean
  mutationPlanningEnabled: boolean
  mutationExecutionEnabled: boolean
  invoiceIssueEnabled: boolean
  invoiceVoidEnabled: boolean
  invoiceReissueEnabled: boolean
  invoiceAdjustmentEnabled: boolean
  providerTimeoutMs: number
  chatRateLimit: number
  actionRateLimit: number
  rateWindowSeconds: number
  circuitFailureThreshold: number
  circuitCooldownMs: number
  retentionCleanupEnabled: boolean
  retentionCleanupBatchSize: number
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
  }
  return fallback
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback
}

export function resolveAiRuntimePolicy(runtime: ReturnType<typeof useRuntimeConfig>): AiRuntimePolicy {
  return {
    chatEnabled: booleanValue(runtime.aiChatEnabled, false),
    readToolsEnabled: booleanValue(runtime.aiReadToolsEnabled, false),
    mutationPlanningEnabled: booleanValue(runtime.aiMutationPlanningEnabled, false),
    mutationExecutionEnabled: booleanValue(runtime.aiMutationExecutionEnabled, false),
    invoiceIssueEnabled: booleanValue(runtime.aiInvoiceIssueEnabled, false),
    invoiceVoidEnabled: booleanValue(runtime.aiInvoiceVoidEnabled, false),
    invoiceReissueEnabled: booleanValue(runtime.aiInvoiceReissueEnabled, false),
    invoiceAdjustmentEnabled: booleanValue(runtime.aiInvoiceAdjustmentEnabled, false),
    providerTimeoutMs: boundedNumber(runtime.aiProviderTimeoutMs, 30_000, 1_000, 120_000),
    chatRateLimit: boundedNumber(runtime.aiChatRateLimit, 20, 1, 10_000),
    actionRateLimit: boundedNumber(runtime.aiActionRateLimit, 30, 1, 10_000),
    rateWindowSeconds: boundedNumber(runtime.aiRateWindowSeconds, 60, 10, 3_600),
    circuitFailureThreshold: boundedNumber(runtime.aiCircuitFailureThreshold, 5, 1, 100),
    circuitCooldownMs: boundedNumber(runtime.aiCircuitCooldownMs, 60_000, 1_000, 900_000),
    retentionCleanupEnabled: booleanValue(runtime.aiRetentionCleanupEnabled, true),
    retentionCleanupBatchSize: boundedNumber(runtime.aiRetentionCleanupBatchSize, 500, 1, 5_000),
  }
}

export function getAiRuntimePolicy(event?: H3Event): AiRuntimePolicy {
  return resolveAiRuntimePolicy(useRuntimeConfig(event))
}

const INVOICE_PLAN_FLAG: Record<string, keyof AiRuntimePolicy> = {
  plan_invoice_issue: 'invoiceIssueEnabled',
  plan_void_invoice: 'invoiceVoidEnabled',
  plan_reissue_invoice: 'invoiceReissueEnabled',
  plan_paid_invoice_adjustment: 'invoiceAdjustmentEnabled',
}

const INVOICE_ACTION_FLAG: Record<string, keyof AiRuntimePolicy> = {
  issue_invoices: 'invoiceIssueEnabled',
  void_invoice: 'invoiceVoidEnabled',
  reissue_invoice: 'invoiceReissueEnabled',
  add_invoice_adjustment: 'invoiceAdjustmentEnabled',
}

export function isAiToolRuntimeEnabled(
  policy: AiRuntimePolicy,
  tool: { name: string; mode: 'read' | 'plan' },
): boolean {
  if (tool.mode === 'read') return policy.readToolsEnabled
  if (!policy.mutationPlanningEnabled) return false
  const invoiceFlag = INVOICE_PLAN_FLAG[tool.name]
  return invoiceFlag ? policy[invoiceFlag] === true : true
}

export function isAiActionRuntimeEnabled(policy: AiRuntimePolicy, actionType: string): boolean {
  if (!policy.mutationExecutionEnabled) return false
  const invoiceFlag = INVOICE_ACTION_FLAG[actionType]
  return invoiceFlag ? policy[invoiceFlag] === true : true
}
