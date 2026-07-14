import type { H3Event } from 'h3'
import type { AiBuildingSummary, AiMeterImportIssue, AiMeterImportPreview } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import type { Room } from '~/types/rooms'
import type { AiToolPreviewMeterImportInput } from '~/utils/validators/ai'
import { isUuid } from '~/utils/format/slug'
import { BillingPeriodRepository } from '../../repositories/billing/periods'
import { InvoiceRepository } from '../../repositories/billing/invoices'
import { MeterReadingRepository } from '../../repositories/meter-readings'
import { RoomRepository } from '../../repositories/rooms'
import { can } from '../../utils/permissions'
import { AiBuildingService } from './buildings'
import { parseMeterImportMessage } from './meter-import-parser'

export type AiMeterImportPreviewResult =
  | { status: 'preview'; preview: AiMeterImportPreview }
  | { status: 'needs_clarification'; candidates: AiBuildingSummary[] }
  | { status: 'not_found' }

function canonical(value: string): string {
  return value.trim().toLocaleLowerCase('vi-VN')
}

function resolveRoom(rooms: Room[], reference: string): Room[] {
  const normalized = canonical(reference)
  return rooms.filter((room) => {
    if (isUuid(reference) && room.id === reference) return true
    return [room.code, room.slug, room.roomNumber].some(value => canonical(value) === normalized)
  })
}

function warning(line: number, field: 'electricity' | 'water', code: string, message: string): AiMeterImportIssue {
  return { line, field, code, message }
}

export const AiMeterImportPreviewService = {
  async preview(
    event: H3Event,
    user: AuthUser,
    storedMessageContent: string,
    input: AiToolPreviewMeterImportInput,
  ): Promise<AiMeterImportPreviewResult> {
    if (!can(user, 'meter-readings.write')) throwForbidden('Không có quyền nhập chỉ số đồng hồ')
    const resolution = await AiBuildingService.resolve(event, user, input.building_ref)
    if (resolution.status === 'not_found') return resolution
    if (resolution.status === 'ambiguous') {
      return { status: 'needs_clarification', candidates: resolution.candidates }
    }

    const building = resolution.building
    const parsed = parseMeterImportMessage(storedMessageContent)
    const previousMonth = input.period_month === 1 ? 12 : input.period_month - 1
    const previousYear = input.period_month === 1 ? input.period_year - 1 : input.period_year
    const [rooms, period, currentReadings, previousReadings] = await Promise.all([
      RoomRepository.listByBuilding(event, building.id),
      BillingPeriodRepository.findByBuildingPeriod(event, building.id, input.period_year, input.period_month),
      MeterReadingRepository.findAll(event, {
        building_id: building.id,
        period_year: input.period_year,
        period_month: input.period_month,
      }),
      MeterReadingRepository.findAll(event, {
        building_id: building.id,
        period_year: previousYear,
        period_month: previousMonth,
      }),
    ])
    const invoices = period ? await InvoiceRepository.listByPeriod(event, period.id) : []
    const lockedRoomIds = new Set(invoices.filter(invoice => invoice.status !== 'void').map(invoice => invoice.roomId))
    const blockers = [...parsed.issues]
    const warnings: AiMeterImportIssue[] = []
    const normalized: AiMeterImportPreview['rows'] = []
    const seen = new Set<string>()

    if (!period) {
      blockers.push({ line: 0, field: 'row', code: 'period_not_found', message: 'Kỳ vận hành chưa được mở.' })
    }
    else if (period.status === 'closed') {
      blockers.push({ line: 0, field: 'row', code: 'period_locked', message: 'Kỳ vận hành đã chốt.' })
    }

    for (const row of parsed.rows) {
      if (!row.roomReference) continue
      const roomMatches = resolveRoom(rooms, row.roomReference)
      if (roomMatches.length === 0) {
        blockers.push({ line: row.line, field: 'room', code: 'room_not_found', message: `Không tìm thấy phòng “${row.roomReference}” trong tòa nhà.` })
        continue
      }
      if (roomMatches.length > 1) {
        blockers.push({ line: row.line, field: 'room', code: 'room_ambiguous', message: `Phòng “${row.roomReference}” không xác định duy nhất.` })
        continue
      }
      const room = roomMatches[0]!
      if (lockedRoomIds.has(room.id)) {
        blockers.push({ line: row.line, field: 'room', code: 'invoice_locked', message: `Phòng ${room.roomNumber} đã có hóa đơn đang hiệu lực trong kỳ.` })
      }

      for (const meterType of ['electricity', 'water'] as const) {
        const readingValue = row[meterType]
        if (readingValue === undefined) {
          warnings.push(warning(row.line, meterType, 'reading_omitted', `Không có chỉ số ${meterType === 'electricity' ? 'điện' : 'nước'} cho phòng ${room.roomNumber}.`))
          continue
        }
        const key = `${room.id}:${meterType}`
        if (seen.has(key)) {
          blockers.push({ line: row.line, field: meterType, code: 'duplicate_reading', message: `Chỉ số ${meterType} của phòng ${room.roomNumber} xuất hiện nhiều lần.` })
          continue
        }
        seen.add(key)
        const existing = currentReadings.find(reading =>
          reading.roomId === room.id && reading.meterType === meterType && reading.readingType === 'monthly') ?? null
        const previous = previousReadings.find(reading =>
          reading.roomId === room.id && reading.meterType === meterType && reading.readingType === 'monthly') ?? null
        if (previous && readingValue < previous.readingValue) {
          warnings.push(warning(row.line, meterType, 'reading_decreased', `Chỉ số mới của phòng ${room.roomNumber} thấp hơn kỳ trước.`))
        }
        const largeDelta = meterType === 'electricity' ? 10_000 : 1_000
        if (previous && readingValue - previous.readingValue > largeDelta) {
          warnings.push(warning(row.line, meterType, 'large_increase', `Mức tăng ${meterType === 'electricity' ? 'điện' : 'nước'} của phòng ${room.roomNumber} cao bất thường.`))
        }
        normalized.push({
          sourceLine: row.line,
          roomId: room.id,
          roomNumber: room.roomNumber,
          meterType,
          readingValue,
          previousValue: previous?.readingValue ?? null,
          existingReadingId: existing?.id ?? null,
          expectedUpdatedAt: existing?.updatedAt ?? null,
        })
      }
    }

    return {
      status: 'preview',
      preview: {
        building,
        billingPeriodId: period?.id ?? null,
        billingPeriodUpdatedAt: period?.updatedAt ?? null,
        periodYear: input.period_year,
        periodMonth: input.period_month,
        readingDate: input.reading_date,
        rows: normalized,
        warnings,
        blockers,
      },
    }
  },
}
