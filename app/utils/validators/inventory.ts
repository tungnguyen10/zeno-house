import { z } from 'zod'
import { slugifyName } from '~/utils/format/slug'
import { QUICK_ROOM_MAX, quickRoomSchema } from './buildings'

export const INVENTORY_MAX_ITEMS = 50
const INVENTORY_UNIT_VALUE_MAX = 999_999_999_999

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)

export const inventoryItemInputSchema = z.object({
  name: z.string().trim().min(1, 'Tên không được trống').max(100, 'Tên quá dài'),
  quantity: z.number().int('Số lượng phải là số nguyên').min(1, 'Số lượng tối thiểu 1').max(999, 'Số lượng tối đa 999').default(1),
  condition: z.enum(['good', 'used', 'damaged']).default('good'),
  unit_value: z.preprocess(blankToNull, z.number().int('Đơn giá phải là số nguyên').min(0, 'Đơn giá không được âm').max(INVENTORY_UNIT_VALUE_MAX, 'Đơn giá quá lớn').nullable().default(null)),
  note: z.preprocess(blankToNull, z.string().trim().max(200, 'Ghi chú quá dài').nullable().default(null)),
})

export const inventoryListSchema = z.array(inventoryItemInputSchema)
  .max(INVENTORY_MAX_ITEMS, `Tối đa ${INVENTORY_MAX_ITEMS} món`)
  .superRefine((items, ctx) => {
    const seen = new Set<string>()
    items.forEach((item, index) => {
      const key = item.name.toLocaleLowerCase('vi')
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: [index, 'name'], message: `"${item.name}" bị trùng` })
      }
      seen.add(key)
    })
  })

export const inventoryApplySchema = z.object({
  room_ids: z.array(z.string().uuid('Phòng không hợp lệ')).min(1, 'Chọn ít nhất 1 phòng').max(200, 'Tối đa 200 phòng')
    .superRefine((ids, ctx) => {
      const seen = new Set<string>()
      ids.forEach((id, index) => {
        const key = id.toLowerCase()
        if (seen.has(key)) ctx.addIssue({ code: 'custom', path: [index], message: 'Phòng bị trùng' })
        seen.add(key)
      })
    }),
  mode: z.enum(['merge', 'replace']),
})

export const roomBatchCreateSchema = z.object({
  request_id: z.string().uuid('Mã yêu cầu không hợp lệ'),
  rooms: z.array(quickRoomSchema).min(1, 'Chọn ít nhất 1 phòng').max(QUICK_ROOM_MAX, `Tối đa ${QUICK_ROOM_MAX} phòng mỗi lần`),
  apply_inventory: z.boolean().default(false),
}).superRefine((value, ctx) => {
  const seen = new Set<string>()
  value.rooms.forEach((room, index) => {
    const key = slugifyName(room.room_number) || room.room_number.toLowerCase()
    if (seen.has(key)) {
      ctx.addIssue({ code: 'custom', path: ['rooms', index, 'room_number'], message: `Mã phòng "${room.room_number}" bị trùng` })
    }
    seen.add(key)
  })
})

export type InventoryItemInput = z.infer<typeof inventoryItemInputSchema>
export type InventoryApplyInput = z.infer<typeof inventoryApplySchema>
export type RoomBatchCreateInput = z.infer<typeof roomBatchCreateSchema>
