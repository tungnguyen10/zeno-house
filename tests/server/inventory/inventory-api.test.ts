import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'

const svc = vi.hoisted(() => ({ getTemplate: vi.fn(), saveTemplate: vi.fn(), applyTemplate: vi.fn(), getRoom: vi.fn(), saveRoom: vi.fn() }))
const g = vi.hoisted(() => ({ requireAuth: vi.fn(), getRouterParam: vi.fn(), readBody: vi.fn() }))

vi.mock('../../../server/services/inventory', () => ({ InventoryService: svc }))
vi.stubGlobal('defineEventHandler', (h: unknown) => h)
vi.stubGlobal('requireAuth', g.requireAuth)
vi.stubGlobal('getRouterParam', g.getRouterParam)
vi.stubGlobal('parseBody', async (_event: unknown, schema: z.ZodTypeAny) => {
  const result = schema.safeParse(await g.readBody())
  if (!result.success) throw { statusCode: 422, data: { error: { code: 'VALIDATION_ERROR' } } }
  return result.data
})

beforeEach(() => {
  vi.clearAllMocks()
  g.requireAuth.mockResolvedValue({ id: 'o-1' })
  g.getRouterParam.mockReturnValue('x')
})

describe('inventory API', () => {
  it('PUT template validates and forwards parsed items', async () => {
    g.readBody.mockResolvedValue({ items: [{ name: 'Giường' }] })
    svc.saveTemplate.mockResolvedValue([])
    const { default: h } = await import('../../../server/api/buildings/[id]/inventory-template/index.put')
    await h({} as never)
    expect(svc.saveTemplate).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'x',
      [{ name: 'Giường', quantity: 1, condition: 'good', unit_value: null, note: null }])
  })

  it('PUT room rejects duplicate names with 422', async () => {
    g.readBody.mockResolvedValue({ items: [{ name: 'Tủ' }, { name: 'tủ' }] })
    const { default: h } = await import('../../../server/api/rooms/[id]/inventory.put')
    await expect(h({} as never)).rejects.toMatchObject({ statusCode: 422 })
    expect(svc.saveRoom).not.toHaveBeenCalled()
  })

  it('POST apply validates mode', async () => {
    g.readBody.mockResolvedValue({ room_ids: ['7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f'], mode: 'wipe' })
    const { default: h } = await import('../../../server/api/buildings/[id]/inventory-template/apply.post')
    await expect(h({} as never)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('GET room wraps data', async () => {
    svc.getRoom.mockResolvedValue([{ id: 'i-1' }])
    const { default: h } = await import('../../../server/api/rooms/[id]/inventory.get')
    await expect(h({} as never)).resolves.toEqual({ data: [{ id: 'i-1' }] })
  })
})
