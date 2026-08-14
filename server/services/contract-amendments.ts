import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ContractAmendment } from '~/types/contract-amendments'
import type {
  ContractAmendmentCancelInput,
  ContractAmendmentCreateInput,
  ContractAmendmentPublishInput,
  ContractAmendmentUpdateInput,
} from '~/utils/validators/contract-amendments'
import { contractAmendmentIdSchema, recurringAmendmentRequiresMonthBoundary } from '~/utils/validators/contract-amendments'
import { ContractRepository } from '../repositories/contracts'
import { ContractAmendmentRepository } from '../repositories/contract-amendments'
import { assertBuildingScope } from '../utils/scope'
import { vietnamDateISO } from '../utils/date'

async function resolveContract(event: H3Event, user: AuthUser, identifier: string, access: 'read' | 'write') {
  const contract = await ContractRepository.findByIdentifier(event, identifier)
  if (!contract) throwNotFound('Không tìm thấy hợp đồng')
  await assertBuildingScope(event, user, contract.buildingId, access)
  return contract
}

async function resolveOwnedAmendment(event: H3Event, contractId: string, amendmentId: string) {
  if (!contractAmendmentIdSchema.safeParse(amendmentId).success) {
    throwValidationError('Mã phụ lục hợp đồng không hợp lệ.')
  }
  const amendment = await ContractAmendmentRepository.findById(event, amendmentId)
  if (!amendment || amendment.contractId !== contractId) throwNotFound('Không tìm thấy phụ lục hợp đồng')
  return amendment
}

function validateDraftTerms(
  contract: { status: string; endDate: string },
  input: ContractAmendmentCreateInput | ContractAmendmentUpdateInput,
): void {
  if (contract.status !== 'active') throwConflict('Chỉ có thể tạo phụ lục cho hợp đồng đang hiệu lực.')
  if (input.effective_date > contract.endDate) {
    throwValidationError('Ngày hiệu lực không được sau ngày kết thúc hợp đồng.')
  }
  if (recurringAmendmentRequiresMonthBoundary(input.changes) && !input.effective_date.endsWith('-01')) {
    throwValidationError('Điều khoản ảnh hưởng hóa đơn chỉ có thể hiệu lực vào ngày đầu tháng.')
  }
}

function normalizedDraft(input: ContractAmendmentCreateInput): ContractAmendmentCreateInput {
  return {
    ...input,
    title: input.title.trim(),
    public_content: input.public_content.trim(),
  }
}

export const ContractAmendmentService = {
  async list(event: H3Event, user: AuthUser, contractIdentifier: string): Promise<ContractAmendment[]> {
    requireCapability(user, 'contracts.read', 'Không có quyền xem phụ lục hợp đồng')
    const contract = await resolveContract(event, user, contractIdentifier, 'read')
    return ContractAmendmentRepository.listByContract(event, contract.id)
  },

  async create(
    event: H3Event,
    user: AuthUser,
    contractIdentifier: string,
    input: ContractAmendmentCreateInput,
  ): Promise<ContractAmendment> {
    requireCapability(user, 'contracts.update', 'Không có quyền tạo phụ lục hợp đồng')
    const contract = await resolveContract(event, user, contractIdentifier, 'write')
    validateDraftTerms(contract, input)
    const amendment = await ContractAmendmentRepository.createDraft(
      event,
      contract.id,
      user.id,
      normalizedDraft(input),
      randomUUID(),
    )
    return amendment
  },

  async update(
    event: H3Event,
    user: AuthUser,
    contractIdentifier: string,
    amendmentId: string,
    input: ContractAmendmentUpdateInput,
  ): Promise<ContractAmendment> {
    requireCapability(user, 'contracts.update', 'Không có quyền sửa phụ lục hợp đồng')
    const contract = await resolveContract(event, user, contractIdentifier, 'write')
    const existing = await resolveOwnedAmendment(event, contract.id, amendmentId)
    if (existing.status !== 'draft') throwConflict('Chỉ có thể sửa phụ lục nháp.')
    validateDraftTerms(contract, input)
    const updated = await ContractAmendmentRepository.updateDraft(event, amendmentId, {
      ...input,
      title: input.title.trim(),
      public_content: input.public_content.trim(),
    }, user.id, randomUUID())
    return updated
  },

  async removeDraft(
    event: H3Event,
    user: AuthUser,
    contractIdentifier: string,
    amendmentId: string,
    expectedUpdatedAt: string,
  ): Promise<void> {
    requireCapability(user, 'contracts.update', 'Không có quyền xóa phụ lục hợp đồng')
    const contract = await resolveContract(event, user, contractIdentifier, 'write')
    const existing = await resolveOwnedAmendment(event, contract.id, amendmentId)
    if (existing.status !== 'draft') throwConflict('Chỉ có thể xóa phụ lục nháp.')
    await ContractAmendmentRepository.deleteDraft(
      event, amendmentId, expectedUpdatedAt, user.id, randomUUID(),
    )
  },

  async publish(
    event: H3Event,
    user: AuthUser,
    contractIdentifier: string,
    amendmentId: string,
    input: ContractAmendmentPublishInput,
    today = vietnamDateISO(),
  ): Promise<ContractAmendment> {
    requireCapability(user, 'contracts.update', 'Không có quyền ban hành phụ lục hợp đồng')
    const contract = await resolveContract(event, user, contractIdentifier, 'write')
    await resolveOwnedAmendment(event, contract.id, amendmentId)
    return ContractAmendmentRepository.publish(
      event, amendmentId, input.expected_updated_at, user.id, today, randomUUID(),
    )
  },

  async cancel(
    event: H3Event,
    user: AuthUser,
    contractIdentifier: string,
    amendmentId: string,
    input: ContractAmendmentCancelInput,
  ): Promise<ContractAmendment> {
    requireCapability(user, 'contracts.update', 'Không có quyền hủy phụ lục hợp đồng')
    const contract = await resolveContract(event, user, contractIdentifier, 'write')
    await resolveOwnedAmendment(event, contract.id, amendmentId)
    return ContractAmendmentRepository.cancel(
      event, amendmentId, input.expected_updated_at, user.id, input.reason.trim(), randomUUID(),
    )
  },

  async cancelScheduledForContract(
    event: H3Event,
    actor: AuthUser | null,
    contractId: string,
    reason: string,
  ): Promise<ContractAmendment[]> {
    const amendments = await ContractAmendmentRepository.listByContract(event, contractId)
    const scheduled = amendments.filter(amendment => amendment.status === 'scheduled')
    const cancelled: ContractAmendment[] = []
    for (const amendment of scheduled) {
      cancelled.push(await ContractAmendmentRepository.cancel(
        event, amendment.id, amendment.updatedAt, actor?.id ?? null, reason, randomUUID(),
      ))
    }
    return cancelled
  },

  applyDue(
    event: H3Event,
    asOf = vietnamDateISO(),
    buildingId?: string | null,
  ): Promise<ContractAmendment[]> {
    return ContractAmendmentRepository.applyDue(event, asOf, buildingId)
  },
}
