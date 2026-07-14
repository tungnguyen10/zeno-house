import type { H3Event } from 'h3'
import type { AiActionPlan } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { OPEN_BILLING_PERIOD_EXECUTOR } from './open-billing-period-executor'
import { IMPORT_METER_READINGS_EXECUTOR, UPDATE_METER_READING_EXECUTOR } from './meter-executors'
import { SAVE_UTILITY_USAGE_OVERRIDE_EXECUTOR } from './utility-override-executor'
import {
  ADD_INVOICE_ADJUSTMENT_EXECUTOR,
  ISSUE_INVOICES_EXECUTOR,
  REISSUE_INVOICE_EXECUTOR,
  VOID_INVOICE_EXECUTOR,
} from './invoice-executors'

export interface AiActionExecutionContext {
  event: H3Event
  user: AuthUser
  plan: AiActionPlan
  idempotencyKey: string
}

export interface AiActionExecutor {
  requiredCapability: string
  revalidate?: (context: AiActionExecutionContext) => Promise<void>
  execute: (context: AiActionExecutionContext) => Promise<unknown>
}

export type AiActionExecutorRegistry = Readonly<Record<string, AiActionExecutor>>

export const AI_ACTION_EXECUTORS: AiActionExecutorRegistry = Object.freeze({
  open_billing_period: OPEN_BILLING_PERIOD_EXECUTOR,
  import_meter_readings: IMPORT_METER_READINGS_EXECUTOR,
  update_meter_reading: UPDATE_METER_READING_EXECUTOR,
  save_utility_usage_override: SAVE_UTILITY_USAGE_OVERRIDE_EXECUTOR,
  issue_invoices: ISSUE_INVOICES_EXECUTOR,
  void_invoice: VOID_INVOICE_EXECUTOR,
  reissue_invoice: REISSUE_INVOICE_EXECUTOR,
  add_invoice_adjustment: ADD_INVOICE_ADJUSTMENT_EXECUTOR,
})
