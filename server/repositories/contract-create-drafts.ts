import type { H3Event } from 'h3'
import { db } from '../utils/db'

export interface ContractCreateDraftRow {
  payload: Record<string, unknown>
  updated_at: string
}

// Cast at the boundary until database.types.ts is regenerated after the cloud migration.
const from = (event: H3Event) => db(event).from('contract_create_drafts' as never)

export const ContractCreateDraftRepository = {
  async find(event: H3Event, userId: string): Promise<ContractCreateDraftRow | null> {
    const { data, error } = await from(event).select('payload, updated_at').eq('user_id', userId).maybeSingle()
    if (error) throwDbError(error, 'contractCreateDrafts.find')
    return (data as ContractCreateDraftRow | null) ?? null
  },

  async upsert(event: H3Event, userId: string, payload: Record<string, unknown>): Promise<ContractCreateDraftRow> {
    const { data, error } = await from(event)
      .upsert({ user_id: userId, payload } as never, { onConflict: 'user_id' })
      .select('payload, updated_at')
      .single()
    if (error) throwDbError(error, 'contractCreateDrafts.upsert')
    return data as ContractCreateDraftRow
  },

  async remove(event: H3Event, userId: string): Promise<void> {
    const { error } = await from(event).delete().eq('user_id', userId)
    if (error) throwDbError(error, 'contractCreateDrafts.remove')
  },
}
