/**
 * Parse pasted clipboard text from a spreadsheet column into an ordered list
 * of cell values. Handles:
 * - newlines and carriage returns as row separators
 * - Vietnamese decimal commas (`1.234,5` → `1234.5`)
 * - leading/trailing whitespace
 * - empty trailing lines
 */
export function parsePastedColumn(raw: string): string[] {
  if (!raw) return []
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') {
    lines.pop()
  }
  return lines.map(line => normalizeCell(line.split('\t')[0] ?? ''))
}

function normalizeCell(cell: string): string {
  const trimmed = cell.trim()
  if (trimmed === '') return ''
  // Strip thousand separators that look like dots/spaces, then convert decimal
  // comma to dot. We only do this when the cell is a pure number-like string.
  if (/^[\d.,\s]+$/.test(trimmed)) {
    const hasComma = trimmed.includes(',')
    const hasDot = trimmed.includes('.')
    if (hasComma && hasDot) {
      // 1.234,5 → 1234.5
      return trimmed.replace(/\./g, '').replace(',', '.').replace(/\s+/g, '')
    }
    if (hasComma) {
      // 1234,5 → 1234.5
      return trimmed.replace(',', '.').replace(/\s+/g, '')
    }
    return trimmed.replace(/\s+/g, '')
  }
  return trimmed
}
