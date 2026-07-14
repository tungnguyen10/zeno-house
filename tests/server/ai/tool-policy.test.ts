import { describe, expect, it } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { AI_TOOL_POLICIES, allowedAiToolNames } from '../../../server/services/ai/tools'

function user(role: 'admin' | 'owner' | 'manager' | null): AuthUser {
  return { id: 'user-1', app_metadata: { role } } as AuthUser
}

describe('AI tool policy', () => {
  it('is deny-by-default for users without a role', () => {
    expect(allowedAiToolNames(user(null))).toEqual([])
  })

  it('exposes accepted read and planning tools to an authorized role', () => {
    expect(allowedAiToolNames(user('manager'))).toEqual([
      'get_user_context',
      'list_buildings',
      'get_meter_status',
      'get_billing_period_overview',
      'calculate_billing_draft',
      'plan_open_billing_period',
      'preview_meter_import',
      'plan_meter_reading_update',
      'plan_utility_usage_override',
      'plan_invoice_issue',
      'plan_void_invoice',
      'plan_reissue_invoice',
      'plan_paid_invoice_adjustment',
    ])
    expect(AI_TOOL_POLICIES.filter(policy => policy.mode === 'plan').map(policy => policy.name))
      .toEqual([
        'plan_open_billing_period', 'preview_meter_import', 'plan_meter_reading_update',
        'plan_utility_usage_override', 'plan_invoice_issue', 'plan_void_invoice',
        'plan_reissue_invoice', 'plan_paid_invoice_adjustment',
      ])
  })

  it('does not expose direct mutation or unknown tools', () => {
    const names = AI_TOOL_POLICIES.map(policy => policy.name)
    expect(names).not.toContain('open_billing_period')
    expect(names).not.toContain('confirm_action')
    expect(names).not.toContain('execute_sql')
  })
})
