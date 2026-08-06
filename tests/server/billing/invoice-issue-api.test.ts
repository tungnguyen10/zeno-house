import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  issueInvoicesPreviewSchema,
  issueInvoicesSchema,
} from '../../../app/utils/validators/billing'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getRouterParam: vi.fn(),
  parseBody: vi.fn(),
  preview: vi.fn(),
  confirm: vi.fn(),
}))

vi.mock('../../../server/services/billing/invoice-issue-preview', () => ({
  BillingInvoiceIssueService: { preview: mocks.preview, confirm: mocks.confirm },
}))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', mocks.requireAuth)
vi.stubGlobal('getRouterParam', mocks.getRouterParam)
vi.stubGlobal('parseBody', mocks.parseBody)
vi.stubGlobal('throwValidationError', (message: string) => {
  throw { statusCode: 422, data: { error: { code: 'VALIDATION_ERROR', message } } }
})

const selection = {
  contract_ids: ['00000000-0000-4000-8000-000000000001'],
  due_date_override: '2026-08-09',
}

describe('invoice issue API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'owner-1', app_metadata: { role: 'owner' } })
    mocks.getRouterParam.mockReturnValue('00000000-0000-4000-8000-000000000010')
    mocks.preview.mockResolvedValue({ snapshotHash: 'a'.repeat(64) })
    mocks.confirm.mockResolvedValue({ issuedCount: 1, invoices: [] })
  })

  it('accepts only server-owned preview inputs', () => {
    expect(issueInvoicesPreviewSchema.safeParse(selection).success).toBe(true)
    expect(issueInvoicesPreviewSchema.safeParse({ ...selection, total: 1, lines: [] }).success).toBe(false)
  })

  it('requires snapshot and operation identifiers for confirmation', () => {
    expect(issueInvoicesSchema.safeParse(selection).success).toBe(false)
    expect(issueInvoicesSchema.safeParse({
      ...selection,
      snapshot_hash: 'a'.repeat(64),
      operation_id: '00000000-0000-7000-8000-000000000099',
    }).success).toBe(true)
  })

  it('routes preview and confirmation through the guarded issue service', async () => {
    mocks.parseBody.mockResolvedValueOnce(selection)
    const { default: previewHandler } = await import(
      '../../../server/api/billing/periods/[id]/issue-preview.post'
    )
    await expect(previewHandler({} as never)).resolves.toEqual({ data: { snapshotHash: 'a'.repeat(64) } })
    expect(mocks.parseBody).toHaveBeenCalledWith(expect.anything(), issueInvoicesPreviewSchema)
    expect(mocks.preview).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      '00000000-0000-4000-8000-000000000010',
      selection,
    )

    const confirmation = {
      ...selection,
      snapshot_hash: 'a'.repeat(64),
      operation_id: '00000000-0000-7000-8000-000000000099',
    }
    mocks.parseBody.mockResolvedValueOnce(confirmation)
    const { default: confirmHandler } = await import(
      '../../../server/api/billing/periods/[id]/issue.post'
    )
    await expect(confirmHandler({} as never)).resolves.toEqual({ data: { issuedCount: 1, invoices: [] } })
    expect(mocks.parseBody).toHaveBeenLastCalledWith(expect.anything(), issueInvoicesSchema)
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      '00000000-0000-4000-8000-000000000010',
      confirmation,
    )
  })
})
