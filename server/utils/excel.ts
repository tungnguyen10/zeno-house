import type { H3Event } from 'h3'
import { setResponseHeaders } from 'h3'
import type ExcelJS from 'exceljs'

export const MONEY_FORMAT = '#,##0'

export const TABLE_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}

export function viExportDate(date = new Date()): string {
  return `Ngày ${String(date.getDate()).padStart(2, '0')} tháng ${String(date.getMonth() + 1).padStart(2, '0')} năm ${date.getFullYear()}`
}

export function styleTitleRow(row: ExcelJS.Row, size: number) {
  row.font = { bold: true, size, name: 'Times New Roman' }
  row.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true }
}

export function styleTableRow(row: ExcelJS.Row, bold = false, colCount: number) {
  row.font = { bold, size: 14, name: 'Times New Roman' }
  row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, shrinkToFit: true }
  for (let col = 1; col <= colCount; col++) {
    const cell = row.getCell(col)
    cell.border = TABLE_BORDER
    cell.alignment = row.alignment
    cell.font = row.font
  }
}

export function alignRightCells(row: ExcelJS.Row, from: number, to: number) {
  for (let col = from; col <= to; col++) {
    row.getCell(col).alignment = { horizontal: 'right', vertical: 'middle', shrinkToFit: true }
  }
}

export function setXlsxResponse(event: H3Event, buffer: Buffer, fileName: string) {
  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Length': String(buffer.length),
    'Cache-Control': 'no-store',
  })
}
