import type { H3Event } from 'h3'
import { setResponseHeaders } from 'h3'
import type ExcelJS from 'exceljs'

export const MONEY_FORMAT = '#,##0'

const EXPORT_COLORS = {
  ink: 'FF243B53',
  muted: 'FF526579',
  title: 'FFEAF2F8',
  header: 'FFDCE8F2',
  section: 'FFEEF3F7',
  border: 'FFC9D5DF',
} as const

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function fillRow(row: ExcelJS.Row, colCount: number, argb: string) {
  row.fill = solidFill(argb)
  for (let col = 1; col <= colCount; col++) row.getCell(col).fill = solidFill(argb)
}

export const TABLE_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: EXPORT_COLORS.border } },
  left: { style: 'thin', color: { argb: EXPORT_COLORS.border } },
  bottom: { style: 'thin', color: { argb: EXPORT_COLORS.border } },
  right: { style: 'thin', color: { argb: EXPORT_COLORS.border } },
}

export function viExportDate(date = new Date()): string {
  return `Ngày ${String(date.getDate()).padStart(2, '0')} tháng ${String(date.getMonth() + 1).padStart(2, '0')} năm ${date.getFullYear()}`
}

export function styleTitleRow(row: ExcelJS.Row, size: number) {
  row.font = { bold: true, size, name: 'Times New Roman', color: { argb: EXPORT_COLORS.ink } }
  row.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true }
  fillRow(row, row.cellCount, EXPORT_COLORS.title)
}

export function styleMetaRow(row: ExcelJS.Row, size: number) {
  row.font = { bold: true, size, name: 'Times New Roman', color: { argb: EXPORT_COLORS.muted } }
  row.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true }
}

export function styleDateRow(row: ExcelJS.Row) {
  row.font = { size: 12, name: 'Times New Roman', color: { argb: EXPORT_COLORS.muted } }
  row.alignment = { horizontal: 'right', vertical: 'middle' }
  row.height = 24
}

export function styleTableRow(row: ExcelJS.Row, bold = false, colCount: number) {
  row.font = { bold, size: 14, name: 'Times New Roman', color: { argb: EXPORT_COLORS.ink } }
  row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, shrinkToFit: true }
  row.height = 28
  for (let col = 1; col <= colCount; col++) {
    const cell = row.getCell(col)
    cell.border = TABLE_BORDER
    cell.alignment = row.alignment
    cell.font = row.font
  }
}

export function styleTableHeaderRow(row: ExcelJS.Row, colCount: number) {
  styleTableRow(row, true, colCount)
  row.font = { bold: true, size: 13, name: 'Times New Roman', color: { argb: EXPORT_COLORS.ink } }
  row.height = 34
  fillRow(row, colCount, EXPORT_COLORS.header)
  for (let col = 1; col <= colCount; col++) row.getCell(col).font = row.font
}

export function styleTotalRow(row: ExcelJS.Row, colCount: number) {
  styleTableRow(row, true, colCount)
  row.height = 30
  fillRow(row, colCount, EXPORT_COLORS.title)
}

export function styleSectionRow(row: ExcelJS.Row, colCount: number) {
  row.font = { bold: true, size: 14, name: 'Times New Roman', color: { argb: EXPORT_COLORS.ink } }
  row.alignment = { horizontal: 'left', vertical: 'middle' }
  row.height = 26
  fillRow(row, colCount, EXPORT_COLORS.section)
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
