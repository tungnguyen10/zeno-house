import { z } from 'zod'

export const assignmentCreateSchema = z.object({
  user_id: z.string().uuid('Manager không hợp lệ'),
  building_id: z.string().uuid('Tòa nhà không hợp lệ'),
})

export const assignmentUpdateSchema = z.object({
  can_delete_master_data: z.boolean(),
})

export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>
