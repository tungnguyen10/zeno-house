import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BillingPeriod } from '~/types/billing'
import { BillingPeriodRepository } from '../../repositories/billing-periods'

export const BillingPeriodService = {
  async list(event: H3Event, user: AuthUser, buildingId: string): Promise<BillingPeriod[]> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem chu kỳ thanh toán')
    return BillingPeriodRepository.findByBuilding(event, buildingId)
  },

  async getOrCreate(
    event: H3Event,
    user: AuthUser,
    buildingId: string,
    year: number,
    month: number,
  ): Promise<BillingPeriod> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền truy cập chu kỳ thanh toán')
    const existing = await BillingPeriodRepository.findByPeriod(event, buildingId, year, month)
    if (existing) return existing

    if (!can(user, 'buildings.update')) throwForbidden('Không có quyền tạo chu kỳ thanh toán')
    return BillingPeriodRepository.create(event, {
      building_id: buildingId,
      period_year: year,
      period_month: month,
    })
  },

  async finalize(event: H3Event, user: AuthUser, id: string): Promise<BillingPeriod> {
    if (!can(user, 'buildings.update')) throwForbidden('Không có quyền khóa chu kỳ thanh toán')
    const period = await BillingPeriodRepository.findById(event, id)
    if (!period) throwNotFound('Không tìm thấy chu kỳ thanh toán')
    if (period.status !== 'draft') {
      throw createError({ statusCode: 409, message: 'Chu kỳ không ở trạng thái draft' })
    }
    return BillingPeriodRepository.update(event, id, {
      status: 'finalized',
      finalized_at: new Date().toISOString(),
      finalized_by: user.id,
    })
  },

  async unlock(event: H3Event, user: AuthUser, id: string): Promise<BillingPeriod> {
    if (!can(user, 'buildings.update')) throwForbidden('Không có quyền mở khóa chu kỳ thanh toán')
    const period = await BillingPeriodRepository.findById(event, id)
    if (!period) throwNotFound('Không tìm thấy chu kỳ thanh toán')
    if (period.status !== 'finalized') {
      throw createError({ statusCode: 409, message: 'Chu kỳ không ở trạng thái finalized' })
    }
    return BillingPeriodRepository.update(event, id, { status: 'draft' })
  },

  async listSummary(
    event: H3Event,
    user: AuthUser,
    filters: { buildingId?: string; year?: number },
  ) {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem danh sách chu kỳ thanh toán')
    return BillingPeriodRepository.findAllSummary(event, filters)
  },
}
