import type { H3Event } from 'h3'

export interface TenantVisionRuntime {
  enabled: boolean
  apiKey: string
  model: string
  timeoutMs: number
  dailyLimit: number
  userDailyLimit: number
  dailyBudgetMicroUsd: number
  inputPricePerMTokMicroUsd: number
  outputPricePerMTokMicroUsd: number
  reserveMicroUsd: number
}

type RuntimeInput = Record<string, unknown>

function booleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  return typeof value === 'string' && value.toLowerCase() === 'true'
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (value === undefined || value === null || value === '' || !Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function resolveTenantVisionRuntime(runtime: RuntimeInput): TenantVisionRuntime {
  const apiKey = text(runtime.aiTenantAnthropicApiKey)
  const model = text(runtime.aiTenantVisionModel)
  return {
    enabled: booleanValue(runtime.aiTenantVisionEnabled) && apiKey !== '' && model !== '',
    apiKey,
    model,
    timeoutMs: boundedNumber(runtime.aiTenantVisionTimeoutMs, 30_000, 5_000, 120_000),
    dailyLimit: boundedNumber(runtime.aiTenantOcrDailyLimit, 20, 1, 1_000),
    userDailyLimit: boundedNumber(runtime.aiTenantOcrUserDailyLimit, 10, 1, 1_000),
    dailyBudgetMicroUsd: boundedNumber(runtime.aiTenantOcrDailyBudgetMicroUsd, 1_000_000, 0, 100_000_000),
    inputPricePerMTokMicroUsd: boundedNumber(runtime.aiTenantOcrInputPricePerMTokMicroUsd, 0, 0, 1_000_000_000),
    outputPricePerMTokMicroUsd: boundedNumber(runtime.aiTenantOcrOutputPricePerMTokMicroUsd, 0, 0, 1_000_000_000),
    reserveMicroUsd: boundedNumber(runtime.aiTenantOcrReserveMicroUsd, 20_000, 0, 10_000_000),
  }
}

export function getTenantVisionRuntime(event?: H3Event): TenantVisionRuntime {
  return resolveTenantVisionRuntime(useRuntimeConfig(event) as RuntimeInput)
}
