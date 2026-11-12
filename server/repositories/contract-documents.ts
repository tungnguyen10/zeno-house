import type { H3Event } from 'h3'
import { db } from '../utils/db'
import type { ContractDocumentRow } from '~/utils/mappers/contract-documents'

const BUCKET = 'contract-documents'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const SIGNED_URL_TTL_SECONDS = 60

// Cast at the boundary until database.types.ts is regenerated after the cloud migration.
const client = (event: H3Event) => db(event)

/** Translate contract_document RPC guards into stable API errors (no PII, no index names). */
export function throwContractDocumentError(error: unknown): void {
  if (!error || typeof error !== 'object' || !('message' in error)) return
  const message = String((error as { message?: unknown }).message)
  if (message.includes('CONTRACT_DOCUMENT_ACTIVE_EXISTS')) {
    throwConflict('Hợp đồng đã có tài liệu đang hiệu lực. Hủy bản cũ để phát hành bản thay thế.', { reason: 'CONTRACT_DOCUMENT_ACTIVE_EXISTS' })
  }
  if (message.includes('CONTRACT_DOCUMENT_STATE_INVALID') || message.includes('CONTRACT_DOCUMENT_IMMUTABLE')) {
    throwConflict('Trạng thái tài liệu không cho phép thao tác này.', { reason: 'CONTRACT_DOCUMENT_STATE_INVALID' })
  }
  if (message.includes('CONTRACT_DOCUMENT_REASON_REQUIRED')) {
    throwValidationError('Lý do hủy phải có ít nhất 10 ký tự')
  }
  if (message.includes('CONTRACT_NOT_FOUND')) {
    throwNotFound('Không tìm thấy hợp đồng')
  }
}

async function callRpc(event: H3Event, fn: string, params: Record<string, unknown>): Promise<ContractDocumentRow> {
  const { data, error } = await client(event).rpc(fn as never, params as never)
  if (error) {
    throwContractDocumentError(error)
    throwDbError(error, `contractDocuments.${fn}`)
  }
  return data as unknown as ContractDocumentRow
}

export const ContractDocumentRepository = {
  async reserve(event: H3Event, input: {
    contractId: string
    type: 'contract' | 'appendix'
    amendmentId: string | null
    templateKey: string
    templateVersion: number
    snapshot: Record<string, unknown>
    signedDate: string
    actorId: string
    replacesDocumentId?: string | null
    voidReason?: string | null
  }): Promise<ContractDocumentRow> {
    return callRpc(event, 'reserve_contract_document', {
      p_contract_id: input.contractId,
      p_type: input.type,
      p_amendment_id: input.amendmentId,
      p_template_key: input.templateKey,
      p_template_version: input.templateVersion,
      p_snapshot: input.snapshot,
      p_signed_date: input.signedDate,
      p_actor_id: input.actorId,
      p_replaces_document_id: input.replacesDocumentId ?? null,
      p_void_reason: input.voidReason ?? null,
    })
  },

  async finalize(event: H3Event, documentId: string, storagePath: string, sha256: string, sizeBytes: number, actorId: string): Promise<ContractDocumentRow> {
    return callRpc(event, 'finalize_contract_document', {
      p_document_id: documentId, p_storage_path: storagePath, p_sha256: sha256, p_size_bytes: sizeBytes, p_actor_id: actorId,
    })
  },

  async fail(event: H3Event, documentId: string, errorCode: string): Promise<ContractDocumentRow> {
    return callRpc(event, 'fail_contract_document', { p_document_id: documentId, p_error_code: errorCode })
  },

  async markSigned(event: H3Event, documentId: string, actorId: string): Promise<ContractDocumentRow> {
    return callRpc(event, 'mark_contract_document_signed', { p_document_id: documentId, p_actor_id: actorId })
  },

  async void(event: H3Event, documentId: string, reason: string, actorId: string): Promise<ContractDocumentRow> {
    return callRpc(event, 'void_contract_document', { p_document_id: documentId, p_reason: reason, p_actor_id: actorId })
  },

  async claimStale(event: H3Event, olderThan: string): Promise<ContractDocumentRow[]> {
    const { data, error } = await client(event).rpc('claim_stale_contract_documents' as never, { p_older_than: olderThan } as never)
    if (error) throwDbError(error, 'contractDocuments.claimStale')
    return (data as unknown as ContractDocumentRow[]) ?? []
  },

  async findById(event: H3Event, id: string): Promise<ContractDocumentRow | null> {
    const { data, error } = await client(event)
      .from('contract_documents' as never)
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throwDbError(error, 'contractDocuments.findById')
    return (data as unknown as ContractDocumentRow | null) ?? null
  },

  async listByContract(event: H3Event, contractId: string): Promise<ContractDocumentRow[]> {
    const { data, error } = await client(event)
      .from('contract_documents' as never)
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })
    if (error) throwDbError(error, 'contractDocuments.listByContract')
    return (data as unknown as ContractDocumentRow[]) ?? []
  },

  async upload(event: H3Event, path: string, buffer: Buffer): Promise<void> {
    const { error } = await client(event).storage.from(BUCKET).upload(path, buffer, { contentType: DOCX_MIME, upsert: false })
    if (error) throwDbError(error, 'contractDocuments.upload')
  },

  async removeObject(event: H3Event, path: string): Promise<void> {
    const { error } = await client(event).storage.from(BUCKET).remove([path])
    if (error) throwDbError(error, 'contractDocuments.removeObject')
  },

  async signedUrl(event: H3Event, path: string): Promise<{ url: string; expiresIn: number }> {
    const { data, error } = await client(event).storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (error) throwDbError(error, 'contractDocuments.signedUrl')
    return { url: data.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS }
  },
}
