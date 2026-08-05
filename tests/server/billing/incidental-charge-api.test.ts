import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  incidentalChargeCreateSchema,
  incidentalChargeDeleteSchema,
  incidentalChargeUpdateSchema,
} from '~/utils/validators/billing'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(), getRouterParam: vi.fn(), parseBody: vi.fn(), setStatus: vi.fn(),
  list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
}))

vi.mock('../../../server/services/billing/incidental-charges', () => ({ BillingIncidentalChargeService: {
  list: mocks.list, create: mocks.create, update: mocks.update, remove: mocks.remove,
} }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', mocks.requireAuth)
vi.stubGlobal('getRouterParam', mocks.getRouterParam)
vi.stubGlobal('parseBody', mocks.parseBody)
vi.stubGlobal('setResponseStatus', mocks.setStatus)
vi.stubGlobal('throwValidationError', (message: string) => {
  throw { statusCode: 422, data: { error: { code: 'VALIDATION_ERROR', message } } }
})

const periodId = '10000000-0000-4000-8000-000000000002'
const chargeId = '10000000-0000-4000-8000-000000000006'
const user = { id: 'actor' }
const charge = { id: chargeId }

describe('incidental charge API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue(user)
    mocks.getRouterParam.mockImplementation((_event, name) => name === 'id' ? periodId : chargeId)
    mocks.list.mockResolvedValue([charge])
    mocks.create.mockResolvedValue(charge)
    mocks.update.mockResolvedValue(charge)
    mocks.remove.mockResolvedValue(charge)
  })

  it('lists and creates period charges with standard envelopes', async () => {
    const { default: getHandler } = await import('../../../server/api/billing/periods/[id]/incidental-charges/index.get')
    await expect(getHandler({} as never)).resolves.toEqual({ data: [charge], meta: { total: 1 } })

    const createInput = { contract_id: chargeId, label: 'Phí chìa khóa', amount: 150_000, operation_id: chargeId }
    mocks.parseBody.mockResolvedValueOnce(createInput)
    const { default: postHandler } = await import('../../../server/api/billing/periods/[id]/incidental-charges/index.post')
    await expect(postHandler({} as never)).resolves.toEqual({ data: charge })
    expect(mocks.parseBody).toHaveBeenCalledWith(expect.anything(), incidentalChargeCreateSchema)
    expect(mocks.create).toHaveBeenCalledWith(expect.anything(), user, periodId, createInput)
    expect(mocks.setStatus).toHaveBeenCalledWith(expect.anything(), 201)
  })

  it('updates and deletes a charge using optimistic schemas', async () => {
    const updateInput = { label: 'Cấp lại chìa khóa', expected_updated_at: '2026-08-05T10:00:00.000Z' }
    mocks.parseBody.mockResolvedValueOnce(updateInput)
    const { default: patchHandler } = await import('../../../server/api/billing/periods/[id]/incidental-charges/[chargeId].patch')
    await expect(patchHandler({} as never)).resolves.toEqual({ data: charge })
    expect(mocks.parseBody).toHaveBeenCalledWith(expect.anything(), incidentalChargeUpdateSchema)
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), user, periodId, chargeId, updateInput)

    const deleteInput = { expected_updated_at: '2026-08-05T10:00:00.000Z' }
    mocks.parseBody.mockResolvedValueOnce(deleteInput)
    const { default: deleteHandler } = await import('../../../server/api/billing/periods/[id]/incidental-charges/[chargeId].delete')
    await expect(deleteHandler({} as never)).resolves.toEqual({ data: charge })
    expect(mocks.parseBody).toHaveBeenLastCalledWith(expect.anything(), incidentalChargeDeleteSchema)
    expect(mocks.remove).toHaveBeenCalledWith(expect.anything(), user, periodId, chargeId, deleteInput)
  })
})
