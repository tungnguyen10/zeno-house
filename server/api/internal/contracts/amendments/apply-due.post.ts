import { ContractAmendmentService } from '../../../../services/contract-amendments'

export default defineEventHandler(async (event) => {
  const secret = useRuntimeConfig(event).contractAmendmentsApplySecret
  if (!secret || getHeader(event, 'x-contract-amendments-secret') !== secret) {
    throwForbidden('Không có quyền áp dụng phụ lục hợp đồng đến hạn')
  }
  const amendments = await ContractAmendmentService.applyDue(event)
  return {
    data: {
      applied: amendments.length,
      amendmentIds: amendments.map(amendment => amendment.id),
    },
  }
})
