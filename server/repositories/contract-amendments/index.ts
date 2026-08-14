import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '~/types/database.types'
import type { ContractAmendment, TenantContractAmendmentSummary } from '~/types/contract-amendments'
import type {
  ContractAmendmentCreateInput,
  ContractAmendmentUpdateInput,
} from '~/utils/validators/contract-amendments'
import {
  mapContractAmendment,
  mapTenantContractAmendment,
  type ContractAmendmentRow,
} from '~/utils/mappers/contract-amendments'
import { db as serverSupabaseClient } from '../../utils/db'

type AmendmentDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      contract_amendments: {
        Row: ContractAmendmentRow
        Insert: {
          contract_id: string
          sequence_no: number
          title: string
          public_content: string
          effective_date: string
          changes: Json
          created_by: string | null
        }
        Update: Partial<ContractAmendmentRow>
        Relationships: []
      }
    }
  }
}

type AmendmentRpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: ContractAmendmentRow | ContractAmendmentRow[] | null; error: unknown }>

function client(event: H3Event): SupabaseClient<AmendmentDatabase> {
  return serverSupabaseClient(event) as unknown as SupabaseClient<AmendmentDatabase>
}

function errorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' ? message.toUpperCase() : ''
}

export function throwContractAmendmentRpcError(error: unknown): never {
  const message = errorMessage(error)
  if (message.includes('AMENDMENT_VERSION_CONFLICT')) {
    throwConflict('Phụ lục đã thay đổi. Vui lòng tải lại dữ liệu.', {
      category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true,
    })
  }
  if (message.includes('AMENDMENT_NOT_DRAFT')) {
    throwConflict('Chỉ có thể thay đổi phụ lục nháp.')
  }
  if (message.includes('AMENDMENT_NOT_FOUND')) throwNotFound('Không tìm thấy phụ lục hợp đồng')
  if (message.includes('AMENDMENT_ALREADY_SCHEDULED')) {
    throwConflict('Hợp đồng đã có một phụ lục đang chờ áp dụng.')
  }
  if (message.includes('AMENDMENT_INVOICE_CONFLICT')) {
    throwConflict('Kỳ hiệu lực đã có hóa đơn chưa hủy, không thể ban hành phụ lục.')
  }
  if (message.includes('CONTRACT_NOT_ACTIVE')) {
    throwConflict('Chỉ có thể ban hành phụ lục cho hợp đồng đang hiệu lực.')
  }
  if (
    message.includes('AMENDMENT_NOT_DRAFT')
    || message.includes('AMENDMENT_NOT_SCHEDULED')
    || message.includes('AMENDMENT_EFFECTIVE_DATE_IN_PAST')
    || message.includes('AMENDMENT_AFTER_CONTRACT_END')
    || message.includes('AMENDMENT_REQUIRES_MONTH_BOUNDARY')
    || message.includes('AMENDMENT_CANCEL_REASON_REQUIRED')
  ) {
    throwValidationError('Trạng thái hoặc ngày hiệu lực của phụ lục không hợp lệ.')
  }
  throwDbError(error, 'contractAmendments.rpc')
}

async function callSingleRpc(
  event: H3Event,
  name: string,
  args: Record<string, unknown>,
): Promise<ContractAmendment> {
  const rpc = client(event).rpc as unknown as AmendmentRpc
  const { data, error } = await rpc(name, args)
  if (error) throwContractAmendmentRpcError(error)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throwInternal(new Error(`Empty ${name} result`), 'contractAmendments.rpc')
  return mapContractAmendment(row)
}

export const ContractAmendmentRepository = {
  async listByContract(event: H3Event, contractId: string): Promise<ContractAmendment[]> {
    const { data, error } = await client(event)
      .from('contract_amendments')
      .select('*')
      .eq('contract_id', contractId)
      .order('sequence_no', { ascending: false })
    if (error) throwDbError(error, 'contractAmendments.listByContract')
    return (data ?? []).map(mapContractAmendment)
  },

  async findById(event: H3Event, amendmentId: string): Promise<ContractAmendment | null> {
    const { data, error } = await client(event)
      .from('contract_amendments')
      .select('*')
      .eq('id', amendmentId)
      .maybeSingle()
    if (error) throwDbError(error, 'contractAmendments.findById')
    return data ? mapContractAmendment(data) : null
  },

  async listPublishedByContract(event: H3Event, contractId: string): Promise<ContractAmendment[]> {
    const { data, error } = await client(event)
      .from('contract_amendments')
      .select('*')
      .eq('contract_id', contractId)
      .neq('status', 'draft')
      .order('sequence_no', { ascending: false })
    if (error) throwDbError(error, 'contractAmendments.listPublishedByContract')
    return (data ?? []).map(mapContractAmendment)
  },

  async listTenantVisible(event: H3Event, contractId: string): Promise<TenantContractAmendmentSummary[]> {
    const { data, error } = await client(event)
      .from('contract_amendments')
      .select('*')
      .eq('contract_id', contractId)
      .in('status', ['scheduled', 'applied'])
      .order('sequence_no', { ascending: false })
    if (error) throwDbError(error, 'contractAmendments.listTenantVisible')
    return (data ?? []).map(mapTenantContractAmendment)
  },

  async deleteDraftsByContract(event: H3Event, contractId: string): Promise<ContractAmendment[]> {
    const { data, error } = await client(event)
      .from('contract_amendments')
      .delete()
      .eq('contract_id', contractId)
      .eq('status', 'draft')
      .select('*')
    if (error) throwDbError(error, 'contractAmendments.deleteDraftsByContract')
    return (data ?? []).map(mapContractAmendment)
  },

  async createDraft(
    event: H3Event,
    contractId: string,
    actorId: string | null,
    input: ContractAmendmentCreateInput,
    operationId: string,
  ): Promise<ContractAmendment> {
    return callSingleRpc(event, 'create_contract_amendment_draft', {
      p_contract_id: contractId,
      p_title: input.title,
      p_public_content: input.public_content,
      p_effective_date: input.effective_date,
      p_changes: input.changes as Json,
      p_actor_id: actorId,
      p_operation_id: operationId,
    })
  },

  async updateDraft(
    event: H3Event,
    amendmentId: string,
    input: ContractAmendmentUpdateInput,
    actorId: string,
    operationId: string,
  ): Promise<ContractAmendment> {
    return callSingleRpc(event, 'update_contract_amendment_draft', {
      p_amendment_id: amendmentId,
      p_title: input.title,
      p_public_content: input.public_content,
      p_effective_date: input.effective_date,
      p_changes: input.changes as Json,
      p_expected_updated_at: input.expected_updated_at,
      p_actor_id: actorId,
      p_operation_id: operationId,
    })
  },

  async deleteDraft(
    event: H3Event,
    amendmentId: string,
    expectedUpdatedAt: string,
    actorId: string,
    operationId: string,
  ): Promise<void> {
    const rpc = client(event).rpc as unknown as AmendmentRpc
    const { error } = await rpc('delete_contract_amendment_draft', {
      p_amendment_id: amendmentId,
      p_expected_updated_at: expectedUpdatedAt,
      p_actor_id: actorId,
      p_operation_id: operationId,
    })
    if (error) throwContractAmendmentRpcError(error)
  },

  publish(
    event: H3Event,
    amendmentId: string,
    expectedUpdatedAt: string,
    actorId: string,
    today: string,
    operationId: string,
  ): Promise<ContractAmendment> {
    return callSingleRpc(event, 'publish_contract_amendment', {
      p_amendment_id: amendmentId,
      p_expected_updated_at: expectedUpdatedAt,
      p_actor_id: actorId,
      p_today: today,
      p_operation_id: operationId,
    })
  },

  cancel(
    event: H3Event,
    amendmentId: string,
    expectedUpdatedAt: string,
    actorId: string | null,
    reason: string,
    operationId: string,
  ): Promise<ContractAmendment> {
    return callSingleRpc(event, 'cancel_contract_amendment', {
      p_amendment_id: amendmentId,
      p_expected_updated_at: expectedUpdatedAt,
      p_actor_id: actorId,
      p_reason: reason,
      p_operation_id: operationId,
    })
  },

  async applyDue(event: H3Event, asOf: string, buildingId?: string | null): Promise<ContractAmendment[]> {
    const rpc = client(event).rpc as unknown as AmendmentRpc
    const { data, error } = await rpc('apply_due_contract_amendments', {
      p_as_of: asOf,
      p_building_id: buildingId ?? null,
    })
    if (error) throwContractAmendmentRpcError(error)
    const rows = Array.isArray(data) ? data : data ? [data] : []
    return rows.map(mapContractAmendment)
  },
}
