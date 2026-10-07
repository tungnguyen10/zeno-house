import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { CheckoutBundle, CheckoutDraftInput } from '~/types/checkout'
import type { CheckoutChargeInput, CheckoutChargeModesInput, CheckoutConfirmInput, CheckoutCorrectionInput, CheckoutCreditInput, CheckoutRefundInput, CheckoutReturnInput } from '~/utils/validators/checkout'
import { CheckoutRepository } from '../repositories/checkout'
import { ContractRepository } from '../repositories/contracts'
import { assertBuildingScope } from '../utils/scope'
import { requireCapability } from '../utils/permissions'
import { checkoutEnabledForBuilding } from '../utils/checkout-feature'
import { vietnamDateISO } from '../utils/date'
import { invalidateOperationsReport } from './operations-report/cache'

async function resolve(event: H3Event, user: AuthUser, identifier: string, capability: string, write = false) {
  requireCapability(user, capability)
  const contract = await ContractRepository.findByIdentifier(event, identifier)
  if (!contract) throwNotFound('Không tìm thấy hợp đồng')
  await assertBuildingScope(event, user, contract.buildingId, write ? 'write' : 'read')
  return contract
}

async function writable(event: H3Event, user: AuthUser, identifier: string, capability: string) {
  const contract = await resolve(event, user, identifier, capability, true)
  return contract
}

const enabled = (bundle: Omit<CheckoutBundle, 'enabled'>, settlementEnabled: boolean): CheckoutBundle => ({ ...bundle, enabled: true, settlementEnabled })

export const CheckoutService = {
  async saveChargeModes(event: H3Event, user: AuthUser, identifier: string, input: CheckoutChargeModesInput) {
    const contract = await writable(event, user, identifier, 'contracts.update')
    return enabled(await CheckoutRepository.saveChargeModes(event, contract.id, user.id, input), checkoutEnabledForBuilding(event, contract.buildingId))
  },
  async issueFinal(event: H3Event, user: AuthUser, identifier: string, input: CheckoutConfirmInput) {
    const contract = await writable(event, user, identifier, 'billing.write')
    const result = await CheckoutRepository.issueFinal(event, contract.id, user.id, input)
    invalidateOperationsReport(contract.buildingId)
    return enabled(result, checkoutEnabledForBuilding(event, contract.buildingId))
  },
  async correct(event: H3Event, user: AuthUser, identifier: string, input: CheckoutCorrectionInput) {
    const contract = await writable(event, user, identifier, 'contracts.settle')
    if (!checkoutEnabledForBuilding(event, contract.buildingId)) throwConflict('Điều chỉnh quyết toán chỉ được bật cho tòa nhà thí điểm')
    requireCapability(user, 'billing.corrections')
    const result = await CheckoutRepository.correct(event, contract.id, user.id, input)
    invalidateOperationsReport(contract.buildingId)
    return enabled(result, checkoutEnabledForBuilding(event, contract.buildingId))
  },
  async get(event: H3Event, user: AuthUser, identifier: string): Promise<CheckoutBundle> {
    const contract = await resolve(event, user, identifier, 'contracts.read')
    const result = await CheckoutRepository.get(event, contract.id)
    return { ...result, enabled: result.schemaAvailable !== false, settlementEnabled: checkoutEnabledForBuilding(event, contract.buildingId) }
  },
  async save(event: H3Event, user: AuthUser, identifier: string, input: CheckoutDraftInput) {
    const contract = await writable(event, user, identifier, 'contracts.update')
    if (input.actual_return_date < contract.startDate || input.actual_return_date > vietnamDateISO()) {
      throwValidationError('Ngày trả phòng phải từ ngày nhận phòng đến hôm nay')
    }
    return enabled(await CheckoutRepository.save(event, contract.id, user.id, input), checkoutEnabledForBuilding(event, contract.buildingId))
  },
  async returnRoom(event: H3Event, user: AuthUser, identifier: string, input: CheckoutReturnInput) {
    const contract = await writable(event, user, identifier, 'contracts.update')
    return enabled(await CheckoutRepository.returnRoom(event, contract.id, user.id, input, checkoutEnabledForBuilding(event, contract.buildingId) ? 'settlement' : 'standard'), checkoutEnabledForBuilding(event, contract.buildingId))
  },
  async preview(event: H3Event, user: AuthUser, identifier: string) {
    const contract = await resolve(event, user, identifier, 'contracts.read')
    return CheckoutRepository.preview(event, contract.id)
  },
  async confirm(event: H3Event, user: AuthUser, identifier: string, input: CheckoutConfirmInput) {
    const contract = await writable(event, user, identifier, 'contracts.settle')
    if (!checkoutEnabledForBuilding(event, contract.buildingId)) throwConflict('Quyết toán cọc chỉ được bật cho tòa nhà thí điểm')
    const result = await CheckoutRepository.confirm(event, contract.id, user.id, input)
    invalidateOperationsReport(contract.buildingId)
    return enabled(result, checkoutEnabledForBuilding(event, contract.buildingId))
  },
  async refund(event: H3Event, user: AuthUser, identifier: string, input: CheckoutRefundInput) {
    const contract = await writable(event, user, identifier, 'contracts.refund')
    if (!checkoutEnabledForBuilding(event, contract.buildingId)) throwConflict('Hoàn cọc trong quyết toán chỉ được bật cho tòa nhà thí điểm')
    if (input.paid_at > vietnamDateISO()) throwValidationError('Ngày hoàn tiền không được trong tương lai')
    const result = await CheckoutRepository.refund(event, contract.id, user.id, input)
    invalidateOperationsReport(contract.buildingId)
    return enabled(result, checkoutEnabledForBuilding(event, contract.buildingId))
  },
  async credit(event: H3Event, user: AuthUser, identifier: string, input: CheckoutCreditInput) {
    const contract = await writable(event, user, identifier, 'contracts.settle')
    if (!checkoutEnabledForBuilding(event, contract.buildingId)) throwConflict('Duyệt bù trừ chỉ được bật cho tòa nhà thí điểm')
    return enabled(await CheckoutRepository.credit(event, contract.id, user.id, input), checkoutEnabledForBuilding(event, contract.buildingId))
  },
  async charge(event: H3Event, user: AuthUser, identifier: string, input: CheckoutChargeInput) {
    const contract = await writable(event, user, identifier, 'billing.write')
    return enabled(await CheckoutRepository.charge(event, contract.id, user.id, input), checkoutEnabledForBuilding(event, contract.buildingId))
  },
}
