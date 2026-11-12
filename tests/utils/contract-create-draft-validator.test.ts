import { describe, expect, it } from 'vitest'
import { contractCreateDraftSchema } from '~/utils/validators/contract-create-draft'

describe('contractCreateDraftSchema', () => {
  it('accepts a partial draft', () => {
    expect(contractCreateDraftSchema.safeParse({ room_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e61', open_blocks: ['vehicles'] }).success).toBe(true)
  })

  it.each(['id_number', 'date_of_birth', 'permanent_address', 'id_issued_place'])('rejects identity key %s', (key) => {
    expect(contractCreateDraftSchema.safeParse({ [key]: 'x' }).success).toBe(false)
  })

  it('rejects identity keys nested in occupants', () => {
    expect(contractCreateDraftSchema.safeParse({ occupants: [{ tenant_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e61', tenant_name: 'B', move_in_date: '2026-12-01', billing_counted: true, id_number: '0123' }] }).success).toBe(false)
  })
})
