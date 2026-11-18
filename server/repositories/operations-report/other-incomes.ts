import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BuildingOtherIncome } from '~/types/operations-report'
import type {
  BuildingOtherIncomeCreateInput,
  BuildingOtherIncomeUpdateInput,
  BuildingOtherIncomeVoidInput,
  OperationsReportQuery,
} from '~/utils/validators/operations-report'
import { mapBuildingOtherIncome, type BuildingOtherIncomeRow } from '~/utils/mappers/operations-report'
import { db } from '../../utils/db'

type MutationPayload = BuildingOtherIncomeCreateInput | BuildingOtherIncomeUpdateInput | BuildingOtherIncomeVoidInput
type MutationArgs = {
  p_action: 'create' | 'update' | 'void'
  p_actor_id: string
  p_income_id: string | null
  p_payload: MutationPayload
}

// The generated cloud schema can be refreshed after migration rollout.
type OtherIncomeDatabase = {
  public: {
    Tables: {
      building_other_incomes: { Row: BuildingOtherIncomeRow, Insert: never, Update: never, Relationships: [] }
    }
    Views: Record<never, never>
    Functions: {
      mutate_building_other_income: { Args: MutationArgs, Returns: BuildingOtherIncomeRow }
    }
  }
}

function client(event: H3Event) {
  return db(event) as unknown as SupabaseClient<OtherIncomeDatabase>
}

const conflicts: Record<string, string> = {
  OTHER_INCOME_DUPLICATE: 'Có giao dịch có thể trùng. Vui lòng xác nhận đây là khoản thu độc lập.',
  OTHER_INCOME_PERIOD_CLOSED: 'Kỳ báo cáo đã chốt. Vui lòng tải lại báo cáo.',
  OTHER_INCOME_STALE: 'Khoản thu đã thay đổi. Vui lòng tải lại để xem phiên bản mới.',
  OTHER_INCOME_OPERATION_CONFLICT: 'Mã thao tác đã được dùng cho một khoản thu khác.',
  OTHER_INCOME_VOIDED: 'Khoản thu đã bị hủy.',
}

function throwMutationError(error: { message: string }): never {
  const reason = error.message
  if (Object.hasOwn(conflicts, reason)) throwConflict(conflicts[reason], { reason })
  if (reason === 'OTHER_INCOME_NOT_FOUND') throwNotFound('Không tìm thấy khoản thu hoặc tòa nhà')
  if (reason === 'OTHER_INCOME_FORBIDDEN') throwForbidden('Không có quyền thao tác với khoản thu này')
  if (reason === 'OTHER_INCOME_INVALID') throwValidationError('Dữ liệu khoản thu không hợp lệ')
  throwDbError(error, 'operationsReport.otherIncomes.mutate')
}

export const BuildingOtherIncomeRepository = {
  async list(event: H3Event, query: OperationsReportQuery): Promise<BuildingOtherIncome[]> {
    const { data, error } = await client(event).from('building_other_incomes')
      .select('*')
      .eq('building_id', query.building_id)
      .eq('period_year', query.period_year)
      .eq('period_month', query.period_month)
      .is('voided_at', null)
      .order('received_date', { ascending: false })
      .order('id', { ascending: false })
    if (error) throwDbError(error, 'operationsReport.otherIncomes.list')
    return (data ?? []).map(mapBuildingOtherIncome)
  },

  async findById(event: H3Event, id: string): Promise<BuildingOtherIncome | null> {
    const { data, error } = await client(event).from('building_other_incomes')
      .select('*').eq('id', id).maybeSingle()
    if (error) throwDbError(error, 'operationsReport.otherIncomes.findById')
    return data ? mapBuildingOtherIncome(data) : null
  },

  async mutate(event: H3Event, args: MutationArgs): Promise<BuildingOtherIncome> {
    const { data, error } = await client(event).rpc('mutate_building_other_income', args)
    if (error) throwMutationError(error)
    if (!data) throwInternal(new Error('Missing other income result'), 'operationsReport.otherIncomes.mutate')
    return mapBuildingOtherIncome(data)
  },
}
