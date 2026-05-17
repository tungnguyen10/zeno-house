import type { Tables } from '~/types/database.types'
import type { ContractRenewal, ContractRenewalMode } from '~/types/contract-renewals'

export function mapContractRenewal(row: Tables<'contract_renewals'>): ContractRenewal {
  return {
    id: row.id,
    contractId: row.contract_id,
    newContractId: row.new_contract_id,
    mode: row.mode as ContractRenewalMode,
    oldEndDate: row.old_end_date,
    newEndDate: row.new_end_date,
    oldMonthlyRent: row.old_monthly_rent,
    newMonthlyRent: row.new_monthly_rent,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}
