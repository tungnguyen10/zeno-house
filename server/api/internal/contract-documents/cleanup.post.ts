import { ContractDocumentRepository } from '../../../repositories/contract-documents'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const secret = config.contractDocumentsCleanupSecret
  if (!secret || getHeader(event, 'x-contract-documents-cleanup-secret') !== secret) {
    throwForbidden('Không có quyền chạy dọn dẹp tài liệu hợp đồng')
  }

  const stale = await ContractDocumentRepository.claimStale(event, '30 minutes')
  let removed = 0
  for (const row of stale) {
    if (row.storage_path) {
      await ContractDocumentRepository.removeObject(event, row.storage_path).catch(() => {})
      removed++
    }
  }
  return { data: { claimed: stale.length, objectsRemoved: removed } }
})
