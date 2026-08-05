import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BillingIncidentalCharge, BillingPeriod, Invoice } from '~/types/billing'
import type {
  IncidentalChargeCreateInput,
  IncidentalChargeDeleteInput,
  IncidentalChargeUpdateInput,
} from '~/utils/validators/billing'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { BillingIncidentalChargeRepository } from '../../repositories/billing/incidental-charges'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { ContractRepository } from '../../repositories/contracts'
import { can } from '../../utils/permissions'
import { assertBuildingScope } from '../../utils/scope'

function periodBounds(period: BillingPeriod): { start: string; end: string } {
  return {
    start: `${period.periodYear}-${String(period.periodMonth).padStart(2, '0')}-01`,
    end: new Date(Date.UTC(period.periodYear, period.periodMonth, 0)).toISOString().slice(0, 10),
  }
}

function hasEffectiveInvoice(invoices: Invoice[], contractId: string): boolean {
  return invoices.some(invoice => invoice.contractId === contractId && invoice.status !== 'void')
}

async function loadPeriod(
  event: H3Event,
  user: AuthUser,
  billingPeriodId: string,
  mode: 'read' | 'write',
): Promise<BillingPeriod> {
  const period = await BillingPeriodRepository.findById(event, billingPeriodId)
  if (!period) throwNotFound('Không tìm thấy kỳ vận hành')
  await assertBuildingScope(event, user, period.buildingId, mode)
  return period
}

async function assertMutable(
  event: H3Event,
  period: BillingPeriod,
  contractId: string,
): Promise<void> {
  if (period.status === 'closed') throwConflict('Kỳ đã chốt, không thể thay đổi khoản phát sinh.')
  const invoices = await InvoiceRepository.listByPeriod(event, period.id)
  if (hasEffectiveInvoice(invoices, contractId)) {
    throwConflict('Phòng đã có hóa đơn hiệu lực. Hãy dùng luồng điều chỉnh hóa đơn.')
  }
}

export const BillingIncidentalChargeService = {
  async list(event: H3Event, user: AuthUser, billingPeriodId: string): Promise<BillingIncidentalCharge[]> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem khoản phát sinh')
    await loadPeriod(event, user, billingPeriodId, 'read')
    return BillingIncidentalChargeRepository.listByPeriod(event, billingPeriodId)
  },

  async create(
    event: H3Event,
    user: AuthUser,
    billingPeriodId: string,
    input: IncidentalChargeCreateInput,
  ): Promise<BillingIncidentalCharge> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền thêm khoản phát sinh')
    const period = await loadPeriod(event, user, billingPeriodId, 'write')
    const contract = await ContractRepository.findById(event, input.contract_id)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    const bounds = periodBounds(period)
    if (
      contract.buildingId !== period.buildingId
      || !contract.roomId
      || contract.status === 'terminated'
      || contract.startDate > bounds.end
      || contract.endDate < bounds.start
    ) {
      throwValidationError('Hợp đồng không thuộc kỳ vận hành này')
    }
    await assertMutable(event, period, contract.id)
    return BillingIncidentalChargeRepository.createWithAudit(
      event, period.id, user.id, input,
    )
  },

  async update(
    event: H3Event,
    user: AuthUser,
    billingPeriodId: string,
    chargeId: string,
    input: IncidentalChargeUpdateInput,
  ): Promise<BillingIncidentalCharge> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền sửa khoản phát sinh')
    const period = await loadPeriod(event, user, billingPeriodId, 'write')
    const current = await BillingIncidentalChargeRepository.findById(event, chargeId)
    if (!current || current.billingPeriodId !== billingPeriodId) throwNotFound('Không tìm thấy khoản phát sinh')
    await assertMutable(event, period, current.contractId)
    return BillingIncidentalChargeRepository.updateWithAudit(event, period.id, user.id, chargeId, {
      label: input.label ?? current.label,
      amount: input.amount ?? current.amount,
      note: input.note === undefined ? current.note : input.note,
      expected_updated_at: input.expected_updated_at,
    })
  },

  async remove(
    event: H3Event,
    user: AuthUser,
    billingPeriodId: string,
    chargeId: string,
    input: IncidentalChargeDeleteInput,
  ): Promise<BillingIncidentalCharge> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền xóa khoản phát sinh')
    const period = await loadPeriod(event, user, billingPeriodId, 'write')
    const current = await BillingIncidentalChargeRepository.findById(event, chargeId)
    if (!current || current.billingPeriodId !== billingPeriodId) throwNotFound('Không tìm thấy khoản phát sinh')
    await assertMutable(event, period, current.contractId)
    return BillingIncidentalChargeRepository.deleteWithAudit(
      event, period.id, user.id, chargeId, input.expected_updated_at,
    )
  },
}
