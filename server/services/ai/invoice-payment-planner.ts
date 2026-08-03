import type { H3Event } from 'h3'
import type {
  AiActionPlanDto,
  AiBuildingSummary,
  AiInvoicePaymentPreview,
  AiInvoicePaymentPreviewItem,
} from '~/types/ai'
import type { BillingPeriod, Invoice } from '~/types/billing'
import type { Room } from '~/types/rooms'
import type { AuthUser } from '~/types/auth'
import { toAiActionPlanDto } from '~/utils/mappers/ai'
import type { AiToolPlanRecordInvoicePaymentsInput } from '~/utils/validators/ai'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { RoomRepository } from '../../repositories/rooms'
import { can } from '../../utils/permissions'
import { AiActionService } from './actions'
import { AiBuildingService } from './buildings'
import { AiConversationService } from './conversations'
import { hashInvoicePaymentSnapshot } from './invoice-payment-snapshot'

export type AiInvoicePaymentPlanResult =
  | { status: 'planned'; preview: AiInvoicePaymentPreview; actionPlan: AiActionPlanDto }
  | { status: 'no_eligible_payments'; preview: AiInvoicePaymentPreview }
  | { status: 'needs_building_clarification'; buildings: AiBuildingSummary[] }
  | { status: 'building_not_found' }
  | { status: 'period_not_found'; building: AiBuildingSummary }

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('vi-VN')
}

function matchesRoom(room: Room, reference: string): boolean {
  const candidate = normalized(reference)
  return [room.id, room.code, room.slug, room.roomNumber].some(value => normalized(value) === candidate)
}

function paymentDateInVietnam(timestamp: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function previewItem(input: {
  classification: AiInvoicePaymentPreviewItem['classification']
  roomRef: string
  room?: Room
  invoice?: Invoice
  reason?: string
}): AiInvoicePaymentPreviewItem {
  return {
    classification: input.classification,
    roomRef: input.roomRef,
    roomId: input.room?.id ?? null,
    roomNumber: input.room?.roomNumber ?? null,
    invoiceId: input.invoice?.id ?? null,
    invoiceCode: input.invoice?.invoiceCode ?? null,
    totalAmount: input.invoice?.totalAmount ?? 0,
    paidAmount: input.invoice?.paidAmount ?? 0,
    amountToCollect: input.classification === 'eligible' ? input.invoice?.balanceAmount ?? 0 : 0,
    balanceAfter: input.classification === 'eligible' ? 0 : input.invoice?.balanceAmount ?? 0,
    reason: input.reason ?? null,
  }
}

function classifyInvoice(room: Room, roomRef: string, invoices: Invoice[], periodClosed: boolean) {
  const roomInvoices = invoices.filter(invoice => invoice.roomId === room.id)
  const active = roomInvoices.filter(invoice => invoice.status !== 'void')
  if (periodClosed) {
    return previewItem({ classification: 'blocked', roomRef, room, invoice: active[0] ?? roomInvoices[0], reason: 'period_closed' })
  }
  if (active.length > 1) {
    return previewItem({ classification: 'blocked', roomRef, room, reason: 'multiple_active_invoices' })
  }
  const invoice = active[0]
  if (!invoice) {
    const voidInvoice = roomInvoices.find(row => row.status === 'void')
    return voidInvoice
      ? previewItem({ classification: 'blocked', roomRef, room, invoice: voidInvoice, reason: 'invoice_void' })
      : previewItem({ classification: 'no_invoice', roomRef, room, reason: 'no_invoice_in_period' })
  }
  if (invoice.status === 'paid' || invoice.balanceAmount <= 0) {
    return previewItem({ classification: 'already_paid', roomRef, room, invoice, reason: 'already_paid' })
  }
  if (['issued', 'partial', 'overdue'].includes(invoice.status) && invoice.balanceAmount > 0) {
    return previewItem({ classification: 'eligible', roomRef, room, invoice })
  }
  return previewItem({ classification: 'blocked', roomRef, room, invoice, reason: 'invoice_not_collectible' })
}

async function resolveBuilding(
  event: H3Event,
  user: AuthUser,
  reference?: string,
): Promise<AiBuildingSummary | AiInvoicePaymentPlanResult> {
  if (reference) {
    const resolution = await AiBuildingService.resolve(event, user, reference)
    if (resolution.status === 'resolved') return resolution.building
    if (resolution.status === 'ambiguous') {
      return { status: 'needs_building_clarification', buildings: resolution.candidates }
    }
    return { status: 'building_not_found' }
  }
  const buildings = await AiBuildingService.list(event, user)
  if (buildings.length === 1) return buildings[0]!
  if (buildings.length > 1) return { status: 'needs_building_clarification', buildings }
  return { status: 'building_not_found' }
}

async function resolvePeriod(
  event: H3Event,
  buildingId: string,
  input: AiToolPlanRecordInvoicePaymentsInput,
): Promise<BillingPeriod | null> {
  if (input.period_year !== undefined && input.period_month !== undefined) {
    return BillingPeriodRepository.findByBuildingPeriod(
      event, buildingId, input.period_year, input.period_month,
    )
  }
  const periods = await BillingPeriodRepository.list(event, { building_id: buildingId })
  return periods.find(period => period.status !== 'closed') ?? null
}

function warningsFor(preview: AiInvoicePaymentPreview): string[] {
  return [
    ...(preview.alreadyPaidCount ? [`Bỏ qua ${preview.alreadyPaidCount} phòng đã ghi thu.`] : []),
    ...(preview.noInvoiceCount ? [`Bỏ qua ${preview.noInvoiceCount} phòng không có hoá đơn trong kỳ.`] : []),
    ...(preview.invalidRoomCount ? [`Bỏ qua ${preview.invalidRoomCount} mã phòng không hợp lệ hoặc không xác định duy nhất.`] : []),
    ...(preview.blockedCount ? [`Bỏ qua ${preview.blockedCount} phòng không đủ điều kiện ghi thu.`] : []),
  ]
}

export const AiInvoicePaymentPlanner = {
  async plan(
    event: H3Event,
    user: AuthUser,
    conversationId: string,
    currentUserMessageId: string,
    input: AiToolPlanRecordInvoicePaymentsInput,
  ): Promise<AiInvoicePaymentPlanResult> {
    if (!can(user, 'billing.write')) throwForbidden('Không có quyền ghi thu hoá đơn')
    const buildingResult = await resolveBuilding(event, user, input.building_ref)
    if (!('id' in buildingResult)) return buildingResult
    const building = buildingResult
    const period = await resolvePeriod(event, building.id, input)
    if (!period) return { status: 'period_not_found', building }

    const [rooms, invoices] = await Promise.all([
      RoomRepository.listByBuilding(event, building.id),
      InvoiceRepository.listByPeriod(event, period.id),
    ])
    const classified: AiInvoicePaymentPreviewItem[] = []
    if (input.selection.mode === 'rooms') {
      const selectedRoomIds = new Set<string>()
      for (const roomRef of input.selection.room_refs) {
        const matches = rooms.filter(room => matchesRoom(room, roomRef))
        if (matches.length !== 1) {
          classified.push(previewItem({ classification: 'invalid_room', roomRef, reason: 'room_not_unique' }))
          continue
        }
        const room = matches[0]!
        if (selectedRoomIds.has(room.id)) continue
        selectedRoomIds.add(room.id)
        classified.push(classifyInvoice(room, roomRef, invoices, period.status === 'closed'))
      }
    }
    else {
      const roomsById = new Map(rooms.map(room => [room.id, room]))
      const candidateRoomIds = [...new Set(invoices
        .filter(invoice => invoice.status !== 'void' && invoice.balanceAmount > 0)
        .map(invoice => invoice.roomId))]
      for (const roomId of candidateRoomIds) {
        const room = roomsById.get(roomId)
        if (!room) continue
        classified.push(classifyInvoice(room, room.roomNumber, invoices, period.status === 'closed'))
      }
    }

    const eligible = classified.filter(row => row.classification === 'eligible')
    const eligibleInvoices = eligible.map(row => invoices.find(invoice => invoice.id === row.invoiceId)!)
    const message = eligible.length > 0
      ? await AiConversationService.getOwnedUserMessage(event, user, conversationId, currentUserMessageId)
      : null
    const paymentDate = message ? paymentDateInVietnam(message.createdAt) : ''
    const paymentMethod = input.payment_method ?? 'cash'
    const snapshotHash = hashInvoicePaymentSnapshot(period, eligibleInvoices)
    const preview: AiInvoicePaymentPreview = {
      building, billingPeriodId: period.id, periodYear: period.periodYear, periodMonth: period.periodMonth,
      paymentDate, paymentMethod,
      eligible,
      alreadyPaid: classified.filter(row => row.classification === 'already_paid'),
      noInvoice: classified.filter(row => row.classification === 'no_invoice'),
      invalidRoom: classified.filter(row => row.classification === 'invalid_room'),
      blocked: classified.filter(row => row.classification === 'blocked'),
      eligibleCount: eligible.length,
      alreadyPaidCount: classified.filter(row => row.classification === 'already_paid').length,
      noInvoiceCount: classified.filter(row => row.classification === 'no_invoice').length,
      invalidRoomCount: classified.filter(row => row.classification === 'invalid_room').length,
      blockedCount: classified.filter(row => row.classification === 'blocked').length,
      totalAmount: eligible.reduce((sum, row) => sum + row.amountToCollect, 0),
      snapshotHash,
    }
    if (eligible.length === 0) return { status: 'no_eligible_payments', preview }

    const monthLabel = `${String(period.periodMonth).padStart(2, '0')}/${period.periodYear}`
    const plan = await AiActionService.createPlan(event, user, {
      conversation_id: conversationId,
      building_id: building.id,
      action_type: 'record_invoice_payments',
      title: `Ghi thu ${eligible.length} phòng kỳ ${monthLabel}`,
      summary: `Ghi thu đủ ${eligible.length} phòng, tổng cộng ${preview.totalAmount.toLocaleString('vi-VN')} ₫.`,
      normalized_payload: {
        billing_period_id: period.id,
        payments: eligibleInvoices.map(invoice => ({
          invoice_id: invoice.id,
          room_id: invoice.roomId,
          expected_updated_at: invoice.updatedAt,
          expected_balance_amount: invoice.balanceAmount,
        })),
        payment_date: paymentDate,
        payment_method: paymentMethod,
        note: input.note ?? null,
        snapshot_hash: snapshotHash,
      },
      preview: { ...preview },
      warnings: warningsFor(preview),
      resource_versions: {
        period: period.updatedAt,
        payment_snapshot: snapshotHash,
        ...Object.fromEntries(eligibleInvoices.map(invoice => [`invoice:${invoice.id}`, invoice.updatedAt])),
      },
      expires_in_seconds: 900,
    })
    return { status: 'planned', preview, actionPlan: toAiActionPlanDto(plan) }
  },
}
