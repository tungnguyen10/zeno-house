import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type {
  InvoiceListItem,
  InvoiceListMeta,
  InvoiceListQuery,
} from '~/utils/validators/invoices'
import type { InvoiceStatus } from '~/utils/constants/billing'
import { BuildingRepository } from '../../repositories/buildings'
import { CrossPeriodInvoiceRepository } from '../../repositories/invoices'
import { getAssignedBuildingIds } from '../../utils/scope'

function todayInHoChiMinh(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function deriveInvoiceListStatus(
  item: Pick<InvoiceListItem, 'status' | 'due_date' | 'balance_amount'>,
  today = todayInHoChiMinh(),
): InvoiceStatus {
  if (item.status === 'issued' && item.due_date && item.due_date < today && item.balance_amount > 0) {
    return 'overdue'
  }
  return item.status
}

function withDerivedStatus(items: InvoiceListItem[], today: string): InvoiceListItem[] {
  return items.map(item => ({
    ...item,
    status: deriveInvoiceListStatus(item, today),
  }))
}

export const InvoiceQueryService = {
  async list(
    event: H3Event,
    user: AuthUser,
    query: InvoiceListQuery,
  ): Promise<{ data: InvoiceListItem[]; meta: InvoiceListMeta }> {
    if (!can(user, 'billing.read')) throwForbidden('Không có quyền xem hoá đơn')
    if (query.page_size > 100) throwValidationError('page_size tối đa là 100')

    // Admin is unscoped (null); owner/manager are scoped to assigned buildings.
    const buildingScope = await getAssignedBuildingIds(event, user)
    const assignedIds = buildingScope ?? undefined

    let buildingId = query.building_id
    if (buildingId) {
      const building = await BuildingRepository.findByIdentifier(event, buildingId)
      if (!building) throwNotFound('Không tìm thấy tòa nhà')
      buildingId = building.id

      if (assignedIds && !assignedIds.includes(buildingId)) {
        throwForbidden('Không có quyền truy cập building này')
      }
    }
    else if (assignedIds && assignedIds.length === 0) {
      return {
        data: [],
        meta: {
          page: query.page,
          page_size: query.page_size,
          total: 0,
          total_pages: 1,
        },
      }
    }

    const today = todayInHoChiMinh()
    const { items, total } = await CrossPeriodInvoiceRepository.listCrossPeriod(
      event,
      {
        ...query,
        building_id: buildingId,
        today,
      },
      { buildingIds: assignedIds },
    )

    const pageSize = query.page_size
    return {
      data: withDerivedStatus(items, today),
      meta: {
        page: query.page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }
  },
}
