import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { ContractPayment } from '~/types/contract-payments'
import type { ContractPaymentCreateInput, ContractPaymentUpdateInput } from '~/utils/validators/contract-payments'
import { mapContractPayment } from '~/utils/mappers/contract-payments'

export const ContractPaymentRepository = {
  async listByContract(event: H3Event, contractId: string): Promise<ContractPayment[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_payments')
      .select('*')
      .eq('contract_id', contractId)
      .order('paid_at', { ascending: false })
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapContractPayment)
  },

  async findById(event: H3Event, paymentId: string): Promise<ContractPayment | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapContractPayment(data) : null
  },

  async insert(event: H3Event, contractId: string, input: ContractPaymentCreateInput): Promise<ContractPayment> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_payments')
      .insert({
        contract_id: contractId,
        payment_type: input.payment_type,
        amount: input.amount,
        covered_period_start: input.covered_period_start ?? null,
        covered_period_end: input.covered_period_end ?? null,
        paid_at: input.paid_at,
        payment_method: input.payment_method ?? null,
        note: input.note ?? null,
      })
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapContractPayment(data)
  },

  async updateById(event: H3Event, paymentId: string, input: ContractPaymentUpdateInput): Promise<ContractPayment> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('contract_payments')
      .update({
        ...(input.payment_type !== undefined && { payment_type: input.payment_type }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.paid_at !== undefined && { paid_at: input.paid_at }),
        ...(input.covered_period_start !== undefined && { covered_period_start: input.covered_period_start }),
        ...(input.covered_period_end !== undefined && { covered_period_end: input.covered_period_end }),
        ...(input.payment_method !== undefined && { payment_method: input.payment_method }),
        ...(input.note !== undefined && { note: input.note }),
      })
      .eq('id', paymentId)
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapContractPayment(data)
  },

  async deleteById(event: H3Event, paymentId: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client
      .from('contract_payments')
      .delete()
      .eq('id', paymentId)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },
}
