import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ContractDocument, ContractDocumentReadiness } from '~/types/contract-documents'
import { mapContractDocument, type ContractDocumentRow } from '~/utils/mappers/contract-documents'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { ContractRepository } from '../../repositories/contracts'
import { ContractDocumentRepository } from '../../repositories/contract-documents'
import { assertBuildingScope } from '../../utils/scope'
import { AuditService } from '../audit'
import { CONTRACT_TEMPLATES, type TemplateManifestEntry } from '../../assets/contract-templates/manifest'
import { buildContractDocumentData } from './build-data'
import { collectMissing } from './missing'
import { renderDocx } from './render'
import { gatherContractSources, gatherReadinessSources } from './sources'

type DocType = 'contract' | 'appendix'

const TEMPLATE_KEY_BY_TYPE: Record<DocType, TemplateManifestEntry['key']> = {
  contract: 'hop-dong-thue-phong',
  appendix: 'phu-luc-hop-dong',
}

function loadTemplate(type: DocType) {
  const entry = CONTRACT_TEMPLATES[TEMPLATE_KEY_BY_TYPE[type]]
  const buffer = readFileSync(resolve(process.cwd(), 'server/assets/contract-templates', entry.file))
  return { buffer, templateKey: entry.key, templateVersion: entry.version }
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function storagePath(buildingId: string, contractId: string, documentId: string): string {
  return `${buildingId}/${contractId}/${documentId}.docx`
}

/** Appendix generation is deferred; only the contract document type is rendered in this pass. */
function assertContractType(type: DocType) {
  if (type !== 'contract') throwValidationError('Hiện chỉ hỗ trợ phát hành hợp đồng; phụ lục sẽ bổ sung sau.')
}

async function requireContractScope(event: H3Event, user: AuthUser, contractId: string, mode: 'read' | 'write') {
  const contract = await ContractRepository.findByIdentifier(event, contractId)
  if (!contract) throwNotFound('Không tìm thấy hợp đồng')
  await assertBuildingScope(event, user, contract.buildingId, mode)
  return contract
}

async function requireDocumentScope(event: H3Event, user: AuthUser, documentId: string, mode: 'read' | 'write') {
  const row = await ContractDocumentRepository.findById(event, documentId)
  if (!row) throwNotFound('Không tìm thấy tài liệu')
  await assertBuildingScope(event, user, row.building_id, mode)
  return row
}

export const ContractDocumentService = {
  async list(event: H3Event, user: AuthUser, contractId: string): Promise<ContractDocument[]> {
    requireCapability(user, 'contract-documents.read', 'Không có quyền xem tài liệu hợp đồng')
    await requireContractScope(event, user, contractId, 'read')
    const rows = await ContractDocumentRepository.listByContract(event, contractId)
    return rows.map(mapContractDocument)
  },

  async check(event: H3Event, user: AuthUser, contractId: string, input: { type: DocType; amendment_id?: string | null }): Promise<ContractDocumentReadiness> {
    requireCapability(user, 'contract-documents.issue', 'Không có quyền phát hành tài liệu hợp đồng')
    await requireContractScope(event, user, contractId, 'read')
    assertContractType(input.type)
    const sources = await gatherContractSources(event, contractId, new Date().toISOString().slice(0, 10))
    const missing = collectMissing(sources)
    return { ready: missing.length === 0, missing }
  },

  async preview(event: H3Event, user: AuthUser, contractId: string, input: { type: DocType; signed_date: string }): Promise<Buffer> {
    requireCapability(user, 'contract-documents.issue', 'Không có quyền phát hành tài liệu hợp đồng')
    await requireContractScope(event, user, contractId, 'read')
    assertContractType(input.type)
    const sources = await gatherContractSources(event, contractId, input.signed_date)
    const missing = collectMissing(sources)
    if (missing.length > 0) {
      throwValidationError('Thiếu thông tin để xuất tài liệu', { reason: 'CONTRACT_DOCUMENT_INCOMPLETE', missing })
    }
    const { buffer } = loadTemplate(input.type)
    return renderDocx(buffer, buildContractDocumentData(sources))
  },

  async issue(
    event: H3Event,
    user: AuthUser,
    contractId: string,
    input: { type: DocType; amendment_id?: string | null; signed_date: string; request_id: string; replaces_document_id?: string | null; void_reason?: string | null },
  ): Promise<ContractDocument> {
    requireCapability(user, 'contract-documents.issue', 'Không có quyền phát hành tài liệu hợp đồng')
    const contract = await requireContractScope(event, user, contractId, 'write')
    assertContractType(input.type)

    // Idempotency / duplicate guard: an already-issued document of this type is returned as-is
    // unless the caller is explicitly replacing it.
    if (!input.replaces_document_id) {
      const existing = (await ContractDocumentRepository.listByContract(event, contractId))
        .find(d => d.type === input.type && (d.amendment_id ?? null) === (input.amendment_id ?? null) && (d.status === 'issued' || d.status === 'signed'))
      if (existing) return mapContractDocument(existing)
    }

    const sources = await gatherContractSources(event, contractId, input.signed_date)
    const missing = collectMissing(sources)
    if (missing.length > 0) {
      throwValidationError('Thiếu thông tin để xuất tài liệu', { reason: 'CONTRACT_DOCUMENT_INCOMPLETE', missing })
    }

    const { buffer: templateBuffer, templateKey, templateVersion } = loadTemplate(input.type)
    const snapshot = buildContractDocumentData(sources)
    const rendered = renderDocx(templateBuffer, snapshot)

    const reserved = await ContractDocumentRepository.reserve(event, {
      contractId: contract.id,
      type: input.type,
      amendmentId: input.amendment_id ?? null,
      templateKey,
      templateVersion,
      snapshot,
      signedDate: input.signed_date,
      actorId: user.id,
      replacesDocumentId: input.replaces_document_id ?? null,
      voidReason: input.void_reason ?? null,
    })

    const path = storagePath(reserved.building_id, reserved.contract_id, reserved.id)
    try {
      await ContractDocumentRepository.upload(event, path, rendered)
    }
    catch (error) {
      await ContractDocumentRepository.fail(event, reserved.id, 'UPLOAD_FAILED').catch(() => {})
      throw error
    }

    let finalized: ContractDocumentRow
    try {
      finalized = await ContractDocumentRepository.finalize(event, reserved.id, path, sha256(rendered), rendered.length, user.id)
    }
    catch (error) {
      await ContractDocumentRepository.removeObject(event, path).catch(() => {})
      await ContractDocumentRepository.fail(event, reserved.id, 'FINALIZE_FAILED').catch(() => {})
      throw error
    }

    await AuditService.append(event, user, {
      building_id: finalized.building_id,
      action: AUDIT_ACTIONS.CONTRACT_DOCUMENT_ISSUED,
      entity_type: 'contract',
      entity_id: finalized.contract_id,
      metadata: { document_id: finalized.id, type: finalized.type, version_no: finalized.version_no, template_version: finalized.template_version, sha256: finalized.sha256 },
    })
    return mapContractDocument(finalized)
  },

  async regenerate(event: H3Event, user: AuthUser, documentId: string): Promise<ContractDocument> {
    requireCapability(user, 'contract-documents.issue', 'Không có quyền phát hành tài liệu hợp đồng')
    const row = await requireDocumentScope(event, user, documentId, 'write')
    if (row.status !== 'failed') throwConflict('Chỉ tạo lại được tài liệu đang ở trạng thái lỗi.', { reason: 'CONTRACT_DOCUMENT_STATE_INVALID' })

    const entry = Object.values(CONTRACT_TEMPLATES).find(e => e.key === row.template_key)
    if (!entry) throwValidationError('Không tìm thấy mẫu tài liệu')
    const templateBuffer = readFileSync(resolve(process.cwd(), 'server/assets/contract-templates', entry!.file))
    // Re-render from the stored snapshot — never re-read live data.
    const rendered = renderDocx(templateBuffer, row.snapshot as Record<string, unknown>)
    const path = storagePath(row.building_id, row.contract_id, row.id)

    await ContractDocumentRepository.removeObject(event, path).catch(() => {})
    await ContractDocumentRepository.upload(event, path, rendered)
    const finalized = await ContractDocumentRepository.finalize(event, row.id, path, sha256(rendered), rendered.length, user.id)

    await AuditService.append(event, user, {
      building_id: finalized.building_id,
      action: AUDIT_ACTIONS.CONTRACT_DOCUMENT_REGENERATED,
      entity_type: 'contract',
      entity_id: finalized.contract_id,
      metadata: { document_id: finalized.id, type: finalized.type, version_no: finalized.version_no, sha256: finalized.sha256 },
    })
    return mapContractDocument(finalized)
  },

  async sign(event: H3Event, user: AuthUser, documentId: string): Promise<ContractDocument> {
    requireCapability(user, 'contract-documents.sign', 'Không có quyền đánh dấu đã ký')
    const row = await requireDocumentScope(event, user, documentId, 'write')
    const signed = await ContractDocumentRepository.markSigned(event, row.id, user.id)
    await AuditService.append(event, user, {
      building_id: signed.building_id,
      action: AUDIT_ACTIONS.CONTRACT_DOCUMENT_SIGNED,
      entity_type: 'contract',
      entity_id: signed.contract_id,
      metadata: { document_id: signed.id, type: signed.type, version_no: signed.version_no },
    })
    return mapContractDocument(signed)
  },

  async void(event: H3Event, user: AuthUser, documentId: string, reason: string): Promise<ContractDocument> {
    requireCapability(user, 'contract-documents.void', 'Không có quyền hủy tài liệu')
    const row = await requireDocumentScope(event, user, documentId, 'write')
    const voided = await ContractDocumentRepository.void(event, row.id, reason, user.id)
    await AuditService.append(event, user, {
      building_id: voided.building_id,
      action: AUDIT_ACTIONS.CONTRACT_DOCUMENT_VOIDED,
      entity_type: 'contract',
      entity_id: voided.contract_id,
      metadata: { document_id: voided.id, type: voided.type, version_no: voided.version_no },
    })
    return mapContractDocument(voided)
  },

  async readiness(
    event: H3Event,
    user: AuthUser,
    input: { room_id: string; tenant_id: string; occupant_tenant_ids: string[] },
  ): Promise<ContractDocumentReadiness> {
    requireCapability(user, 'contract-documents.issue', 'Không có quyền phát hành tài liệu hợp đồng')
    const { buildingId, sources } = await gatherReadinessSources(event, {
      roomId: input.room_id, tenantId: input.tenant_id, occupantTenantIds: input.occupant_tenant_ids,
    })
    await assertBuildingScope(event, user, buildingId, 'read')
    const missing = collectMissing(sources)
    return { ready: missing.length === 0, missing }
  },

  async download(event: H3Event, user: AuthUser, documentId: string): Promise<{ url: string; expiresIn: number }> {
    requireCapability(user, 'contract-documents.read', 'Không có quyền tải tài liệu')
    const row = await requireDocumentScope(event, user, documentId, 'read')
    if (!row.storage_path) throwConflict('Tài liệu chưa có tệp để tải.', { reason: 'CONTRACT_DOCUMENT_STATE_INVALID' })
    return ContractDocumentRepository.signedUrl(event, row.storage_path)
  },
}
