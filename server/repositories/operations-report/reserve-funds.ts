import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { ReserveFund, ReserveFundTransaction } from '~/types/operations-report'
import {
  mapReserveFund,
  mapReserveFundTransaction,
  type ReserveFundRow,
  type ReserveFundTransactionRow,
} from '~/utils/mappers/operations-report'

export const ReserveFundRepository = {
  async findOrCreateByBuilding(event: H3Event, buildingId: string): Promise<ReserveFundRow> {
    const client = await serverSupabaseClient(event)
    const existing = await client
      .from('reserve_funds')
      .select('*')
      .eq('building_id', buildingId)
      .maybeSingle()
    if (existing.error) throw createError({ statusCode: 500, message: existing.error.message })
    if (existing.data) return existing.data

    const created = await client
      .from('reserve_funds')
      .insert({ building_id: buildingId })
      .select()
      .single()
    if (created.error) throw createError({ statusCode: 500, message: created.error.message })
    return created.data
  },

  async listTransactions(event: H3Event, fundId: string): Promise<ReserveFundTransaction[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('reserve_fund_transactions')
      .select('*')
      .eq('fund_id', fundId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw createError({ statusCode: 500, message: error.message })
    return ((data ?? []) as ReserveFundTransactionRow[]).map(mapReserveFundTransaction)
  },

  async getByBuilding(event: H3Event, buildingId: string): Promise<ReserveFund> {
    const fund = await this.findOrCreateByBuilding(event, buildingId)
    const transactions = await this.listTransactions(event, fund.id)
    return mapReserveFund(fund, transactions)
  },

  async insertTransaction(
    event: H3Event,
    input: {
      fundId: string
      type: 'deposit' | 'withdrawal'
      amount: number
      date: string
      note?: string | null
      linkedExpenseId?: string | null
      createdBy: string
    },
  ): Promise<ReserveFundTransaction> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('reserve_fund_transactions')
      .insert({
        fund_id: input.fundId,
        type: input.type,
        amount: input.amount,
        date: input.date,
        note: input.note ?? null,
        linked_expense_id: input.linkedExpenseId ?? null,
        created_by: input.createdBy,
      })
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapReserveFundTransaction(data as ReserveFundTransactionRow)
  },

  async findWithdrawalByExpense(
    event: H3Event,
    expenseId: string,
  ): Promise<ReserveFundTransaction | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('reserve_fund_transactions')
      .select('*')
      .eq('linked_expense_id', expenseId)
      .eq('type', 'withdrawal')
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapReserveFundTransaction(data as ReserveFundTransactionRow) : null
  },
}
