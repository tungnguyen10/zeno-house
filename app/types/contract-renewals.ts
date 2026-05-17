export type ContractRenewalMode = 'extend' | 'new_contract'

export interface ContractRenewal {
  id: string
  contractId: string
  newContractId: string | null
  mode: ContractRenewalMode
  oldEndDate: string
  newEndDate: string
  oldMonthlyRent: number
  newMonthlyRent: number
  reason: string | null
  createdBy: string
  createdAt: string
}
