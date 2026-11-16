import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ContractCreateDraftInput } from '~/utils/validators/contract-create-draft'
import { ContractCreateDraftRepository } from '../../repositories/contract-create-drafts'

const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface ContractCreateDraft {
  payload: Record<string, unknown>
  updatedAt: string
}

export const ContractCreateDraftService = {
  async get(event: H3Event, user: AuthUser): Promise<ContractCreateDraft | null> {
    requireCapability(user, 'contracts.create', 'Không có quyền tạo hợp đồng')
    const row = await ContractCreateDraftRepository.find(event, user.id)
    if (!row) return null
    if (Date.now() - new Date(row.updated_at).getTime() > DRAFT_TTL_MS) {
      await ContractCreateDraftRepository.remove(event, user.id)
      return null
    }
    return { payload: row.payload, updatedAt: row.updated_at }
  },

  async save(event: H3Event, user: AuthUser, payload: ContractCreateDraftInput): Promise<ContractCreateDraft> {
    requireCapability(user, 'contracts.create', 'Không có quyền tạo hợp đồng')
    const row = await ContractCreateDraftRepository.upsert(event, user.id, payload as Record<string, unknown>)
    return { payload: row.payload, updatedAt: row.updated_at }
  },

  async remove(event: H3Event, user: AuthUser): Promise<void> {
    requireCapability(user, 'contracts.create', 'Không có quyền tạo hợp đồng')
    await ContractCreateDraftRepository.remove(event, user.id)
  },
}
