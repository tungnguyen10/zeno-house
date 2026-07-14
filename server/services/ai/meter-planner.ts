import type { H3Event } from 'h3'
import type { AiActionPlanDto, AiMeterImportPreview } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { toAiActionPlanDto } from '~/utils/mappers/ai'
import type { AiToolPlanMeterReadingUpdateInput, AiToolPreviewMeterImportInput } from '~/utils/validators/ai'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { MeterReadingRepository } from '../../repositories/meter-readings'
import { assertBuildingScope } from '../../utils/scope'
import { can } from '../../utils/permissions'
import { AiActionService } from './actions'
import { AiConversationService } from './conversations'
import { AiMeterImportPreviewService, type AiMeterImportPreviewResult } from './meter-import-preview'

export type AiMeterImportPlanResult =
  | { status: 'planned'; preview: AiMeterImportPreview; actionPlan: AiActionPlanDto }
  | { status: 'blocked'; preview: AiMeterImportPreview }
  | Exclude<AiMeterImportPreviewResult, { status: 'preview' }>

export type AiMeterReadingUpdatePlanResult = {
  status: 'planned'
  actionPlan: AiActionPlanDto
}

function monthLabel(year: number, month: number): string {
  return `${String(month).padStart(2, '0')}/${year}`
}

export const AiMeterPlanner = {
  async planImport(
    event: H3Event,
    user: AuthUser,
    conversationId: string,
    currentUserMessageId: string,
    input: AiToolPreviewMeterImportInput,
  ): Promise<AiMeterImportPlanResult> {
    if (!can(user, 'meter-readings.write')) throwForbidden('Không có quyền nhập chỉ số đồng hồ')
    const message = await AiConversationService.getOwnedUserMessage(
      event, user, conversationId, currentUserMessageId,
    )
    const result = await AiMeterImportPreviewService.preview(event, user, message.content, input)
    if (result.status !== 'preview') return result
    const preview = result.preview
    if (preview.blockers.length > 0 || preview.rows.length === 0 || !preview.billingPeriodId) {
      return { status: 'blocked', preview }
    }

    const readings = preview.rows.map(row => ({
      room_id: row.roomId,
      meter_type: row.meterType,
      reading_value: row.readingValue,
      expected_updated_at: row.expectedUpdatedAt,
    }))
    const resourceVersions: Record<string, string> = {
      [`period:${preview.billingPeriodId}`]: preview.billingPeriodUpdatedAt ?? 'unknown',
    }
    for (const row of preview.rows) {
      resourceVersions[`reading:${row.roomId}:${row.meterType}`] = row.expectedUpdatedAt ?? 'absent'
    }
    const plan = await AiActionService.createPlan(event, user, {
      conversation_id: conversationId,
      building_id: preview.building.id,
      action_type: 'import_meter_readings',
      title: `Nhập chỉ số ${monthLabel(preview.periodYear, preview.periodMonth)}`,
      summary: `Ghi ${readings.length} chỉ số cho ${preview.building.name}.`,
      normalized_payload: {
        building_id: preview.building.id,
        period_year: preview.periodYear,
        period_month: preview.periodMonth,
        reading_date: preview.readingDate,
        readings,
      },
      preview: preview as unknown as Record<string, unknown>,
      warnings: [...new Set(preview.warnings.map(issue => issue.message))],
      resource_versions: resourceVersions,
      expires_in_seconds: 900,
    })
    return { status: 'planned', preview, actionPlan: toAiActionPlanDto(plan) }
  },

  async planUpdate(
    event: H3Event,
    user: AuthUser,
    conversationId: string,
    input: AiToolPlanMeterReadingUpdateInput,
  ): Promise<AiMeterReadingUpdatePlanResult> {
    if (!can(user, 'meter-readings.write')) throwForbidden('Không có quyền sửa chỉ số đồng hồ')
    const reading = await MeterReadingRepository.findById(event, input.reading_id)
    if (!reading) throwNotFound('Không tìm thấy chỉ số')
    await assertBuildingScope(event, user, reading.buildingId, 'write')
    const period = await BillingPeriodRepository.findByBuildingPeriod(
      event, reading.buildingId, reading.periodYear, reading.periodMonth,
    )
    if (reading.readingType === 'monthly' && period?.status === 'closed') {
      throwConflict('Kỳ đã chốt, không thể sửa chỉ số.')
    }
    if (reading.readingType === 'monthly' && period) {
      const invoices = await InvoiceRepository.listByPeriod(event, period.id)
      if (invoices.some(invoice => invoice.roomId === reading.roomId && invoice.status !== 'void')) {
        throwConflict('Phòng đã có hóa đơn đang hiệu lực, không thể sửa chỉ số.')
      }
    }

    const plan = await AiActionService.createPlan(event, user, {
      conversation_id: conversationId,
      building_id: reading.buildingId,
      action_type: 'update_meter_reading',
      title: `Sửa chỉ số ${reading.meterType === 'electricity' ? 'điện' : 'nước'}`,
      summary: `Đổi chỉ số từ ${reading.readingValue} thành ${input.reading_value}.`,
      normalized_payload: {
        reading_id: reading.id,
        reading_value: input.reading_value,
        ...(input.reading_date !== undefined && { reading_date: input.reading_date }),
        ...(input.notes !== undefined && { notes: input.notes }),
        expected_updated_at: reading.updatedAt,
      },
      preview: {
        reading_id: reading.id,
        room_id: reading.roomId,
        meter_type: reading.meterType,
        before: { reading_value: reading.readingValue, reading_date: reading.readingDate, notes: reading.notes },
        after: {
          reading_value: input.reading_value,
          reading_date: input.reading_date ?? reading.readingDate,
          notes: input.notes === undefined ? reading.notes : input.notes,
        },
      },
      warnings: [],
      resource_versions: { [`reading:${reading.id}`]: reading.updatedAt },
      expires_in_seconds: 900,
    })
    return { status: 'planned', actionPlan: toAiActionPlanDto(plan) }
  },
}
