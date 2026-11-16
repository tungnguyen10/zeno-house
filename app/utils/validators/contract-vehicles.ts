import { z } from 'zod'

export const CONTRACT_VEHICLE_MAX = 10

export function normalizePlate(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

export const contractVehicleInputSchema = z.object({
  owner_name: z.string().trim().min(1, 'Tên chủ xe không được trống').max(100, 'Tên chủ xe quá dài'),
  plate_number: z.string().transform(normalizePlate).pipe(z.string().min(1, 'Biển số không được trống').max(20, 'Biển số quá dài')),
  vehicle_type: z.preprocess(blankToNull, z.string().trim().max(50, 'Loại xe quá dài').nullable().default(null)),
  note: z.preprocess(blankToNull, z.string().trim().max(200, 'Ghi chú quá dài').nullable().default(null)),
})

export const contractVehicleListSchema = z.array(contractVehicleInputSchema)
  .max(CONTRACT_VEHICLE_MAX, `Tối đa ${CONTRACT_VEHICLE_MAX} xe`)
  .superRefine((items, ctx) => {
    const seen = new Set<string>()
    items.forEach((item, index) => {
      if (seen.has(item.plate_number)) {
        ctx.addIssue({ code: 'custom', path: [index, 'plate_number'], message: `Biển số ${item.plate_number} bị trùng` })
      }
      seen.add(item.plate_number)
    })
  })

export type ContractVehicleInput = z.infer<typeof contractVehicleInputSchema>
