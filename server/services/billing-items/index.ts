import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BillingItemSummary, BillingItemDetail, BillingPaymentStatus } from '~/types/billing'
import { BillingItemRepository } from '../../repositories/billing-items'
import { BillingContractSnapshotRepository } from '../../repositories/billing-contract-snapshots'
import { BillingServiceSnapshotRepository } from '../../repositories/billing-service-snapshots'
import { BillingUtilitySnapshotRepository } from '../../repositories/billing-utility-snapshots'
import { mapBillingItem } from '~/utils/mappers/billing'
import type { BillingItemFilters } from '../../repositories/billing-items'

export const BillingItemService = {
  async listItems(
    event: H3Event,
    user: AuthUser,
    billingRunId: string | null,
    filters: BillingItemFilters = {},
  ): Promise<BillingItemSummary[]> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem hóa đơn')
    return BillingItemRepository.findByRun(event, billingRunId, filters)
  },

  async getItemDetail(event: H3Event, user: AuthUser, id: string): Promise<BillingItemDetail> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem chi tiết hóa đơn')

    const supabase = await serverSupabaseClient(event)
    const { data: row, error } = await supabase
      .from('billing_items')
      .select('*, rooms(id, room_number, floor), tenants(id, full_name, phone)')
      .eq('id', id)
      .single()

    if (error || !row) throwNotFound('Không tìm thấy hóa đơn')

    const [contractSnapshot, serviceSnapshots, utilitySnapshots] = await Promise.all([
      BillingContractSnapshotRepository.findByItemId(event, id),
      BillingServiceSnapshotRepository.findByItemId(event, id),
      BillingUtilitySnapshotRepository.findByItemId(event, id),
    ])

    if (!contractSnapshot) throwNotFound('Không tìm thấy snapshot hợp đồng')

    const item = mapBillingItem(row!)

    return {
      ...item,
      room: { id: row!.rooms.id, roomNumber: row!.rooms.room_number, floor: row!.rooms.floor },
      tenant: { id: row!.tenants.id, fullName: row!.tenants.full_name, phone: row!.tenants.phone },
      contractSnapshot: contractSnapshot!,
      serviceSnapshots,
      utilitySnapshots,
    }
  },

  async bulkUpdatePaymentStatus(
    event: H3Event,
    user: AuthUser,
    ids: string[],
    status: BillingPaymentStatus,
    meta: {
      paid_by?: string
      payment_method?: string | null
      payment_note?: string | null
    },
  ): Promise<void> {
    if (!can(user, 'buildings.update')) throwForbidden('Không có quyền cập nhật trạng thái thanh toán')
    if (ids.length === 0) return
    await BillingItemRepository.bulkUpdatePaymentStatus(event, ids, status, meta)
  },
}
