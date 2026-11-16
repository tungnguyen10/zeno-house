import type { ApiSuccess } from '~/types/api'
import type {
  ContractDocument,
  ContractDocumentReadiness,
  ContractDocumentType,
} from '~/types/contract-documents'
import { getApiErrorMessage } from '~/utils/api-error'
import { useExportDownload } from '~/composables/useExportDownload'

interface IssueInput {
  type: ContractDocumentType
  amendment_id?: string | null
  signed_date: string
  replaces_document_id?: string | null
  void_reason?: string | null
}

/** Documents list + issue/sign/void/regenerate/download for one contract. */
export function useContractDocuments(contractId: MaybeRefOrGetter<string>) {
  const documents = ref<ContractDocument[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const { downloadBlob } = useExportDownload()

  const base = () => `/api/contracts/${encodeURIComponent(toValue(contractId))}/documents`

  async function refresh() {
    isLoading.value = true
    error.value = null
    try {
      const res = await apiFetch<ApiSuccess<ContractDocument[]>>(base())
      documents.value = res.data
    }
    catch (cause) {
      error.value = getApiErrorMessage(cause, 'Không thể tải danh sách tài liệu.')
    }
    finally {
      isLoading.value = false
    }
  }

  async function check(type: ContractDocumentType, amendmentId?: string | null): Promise<ContractDocumentReadiness> {
    const res = await apiFetch<ApiSuccess<ContractDocumentReadiness>>(`${base()}/check`, {
      method: 'POST',
      body: { type, amendment_id: amendmentId ?? null },
    })
    return res.data
  }

  async function preview(input: { type: ContractDocumentType; amendment_id?: string | null; signed_date: string }) {
    await downloadBlob(`${base()}/preview`, 'hop-dong.docx', { method: 'POST', body: { ...input, amendment_id: input.amendment_id ?? null } })
  }

  async function issue(input: IssueInput): Promise<ContractDocument> {
    const res = await apiFetch<ApiSuccess<ContractDocument>>(base(), {
      method: 'POST',
      body: { ...input, amendment_id: input.amendment_id ?? null, request_id: crypto.randomUUID() },
    })
    await refresh()
    return res.data
  }

  async function download(docId: string) {
    const res = await apiFetch<ApiSuccess<{ url: string; expiresIn: number }>>(
      `/api/contract-documents/${docId}/download`,
    )
    if (import.meta.client) window.open(res.data.url, '_blank')
    return res.data
  }

  async function regenerate(docId: string): Promise<ContractDocument> {
    const res = await apiFetch<ApiSuccess<ContractDocument>>(`/api/contract-documents/${docId}/regenerate`, { method: 'POST' })
    await refresh()
    return res.data
  }

  async function sign(docId: string): Promise<ContractDocument> {
    const res = await apiFetch<ApiSuccess<ContractDocument>>(`/api/contract-documents/${docId}/sign`, { method: 'POST' })
    await refresh()
    return res.data
  }

  async function voidDocument(docId: string, reason: string): Promise<ContractDocument> {
    const res = await apiFetch<ApiSuccess<ContractDocument>>(`/api/contract-documents/${docId}/void`, {
      method: 'POST',
      body: { reason },
    })
    await refresh()
    return res.data
  }

  return { documents, isLoading, error, refresh, check, preview, issue, download, regenerate, sign, voidDocument }
}

/** Pre-contract readiness check used on the create page (no contract yet). */
export async function checkContractDocumentReadiness(input: {
  room_id: string
  tenant_id: string
  occupant_tenant_ids: string[]
}): Promise<ContractDocumentReadiness> {
  const res = await apiFetch<ApiSuccess<ContractDocumentReadiness>>('/api/contract-documents/readiness', {
    method: 'POST',
    body: input,
  })
  return res.data
}
