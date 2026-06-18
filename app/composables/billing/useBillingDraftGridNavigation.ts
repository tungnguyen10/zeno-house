import { nextTick, onBeforeUnmount, ref, type ComputedRef } from 'vue'
import type { BillingDraftGridRow } from '~/types/billing'
import { parsePastedColumn } from '~/utils/billing/clipboard'

type MeterType = 'electricity' | 'water'

export interface BillingDraftGridNavigationOptions {
  filteredRows: ComputedRef<BillingDraftGridRow[]>
  setReadingDraftValue: (row: BillingDraftGridRow, type: MeterType, value: string) => void
}

const PASTE_HIGHLIGHT_MS = 1500

export function billingDraftGridCellKey(row: BillingDraftGridRow, type: MeterType): string {
  return `${row.roomId}::${type}`
}

export function useBillingDraftGridNavigation(options: BillingDraftGridNavigationOptions) {
  const pasteHighlight = ref<Set<string>>(new Set())
  const highlightTimers: ReturnType<typeof setTimeout>[] = []

  onBeforeUnmount(() => {
    for (const timer of highlightTimers) clearTimeout(timer)
  })

  function isPasteHighlighted(row: BillingDraftGridRow, type: MeterType): boolean {
    return pasteHighlight.value.has(billingDraftGridCellKey(row, type))
  }

  function editableRowsFor(type: MeterType): BillingDraftGridRow[] {
    return options.filteredRows.value.filter((row) => {
      const cell = type === 'electricity' ? row.electricity : row.water
      return row.editable && !!cell?.editable
    })
  }

  function editableCellOrder(): Array<{ row: BillingDraftGridRow; type: MeterType }> {
    const cells: Array<{ row: BillingDraftGridRow; type: MeterType }> = []
    for (const row of options.filteredRows.value) {
      if (!row.editable) continue
      if (row.electricity?.editable) cells.push({ row, type: 'electricity' })
      if (row.water?.editable) cells.push({ row, type: 'water' })
    }
    return cells
  }

  function focusReadingCell(row: BillingDraftGridRow, type: MeterType) {
    nextTick(() => {
      const selector = `[data-reading-cell="${row.roomId}::${type}"] input`
      const input = document.querySelector<HTMLInputElement>(selector)
      input?.focus()
      input?.select()
    })
  }

  function handleReadingTab(event: KeyboardEvent, row: BillingDraftGridRow, type: MeterType) {
    event.preventDefault()
    const direction = event.shiftKey ? -1 : 1
    const cells = editableCellOrder()
    const currentIndex = cells.findIndex(cell => cell.row.key === row.key && cell.type === type)
    const next = cells[currentIndex + direction]
    if (next) focusReadingCell(next.row, next.type)
  }

  function handleReadingKeydown(event: KeyboardEvent, row: BillingDraftGridRow, type: MeterType) {
    if (event.key === 'Tab') {
      handleReadingTab(event, row, type)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const direction = event.shiftKey ? -1 : 1
      const rows = editableRowsFor(type)
      const currentIndex = rows.findIndex(candidate => candidate.key === row.key)
      const nextRow = rows[currentIndex + direction]
      if (nextRow) focusReadingCell(nextRow, type)
    }
  }

  function handleReadingPaste(event: ClipboardEvent, row: BillingDraftGridRow, type: MeterType) {
    const text = event.clipboardData?.getData('text/plain') ?? ''
    const values = parsePastedColumn(text)
    if (values.length <= 1) return
    event.preventDefault()
    const rows = editableRowsFor(type)
    const startIndex = rows.findIndex(candidate => candidate.key === row.key)
    if (startIndex < 0) return
    const affected: string[] = []
    values.forEach((value, offset) => {
      const targetRow = rows[startIndex + offset]
      if (!targetRow) return
      options.setReadingDraftValue(targetRow, type, value)
      affected.push(billingDraftGridCellKey(targetRow, type))
    })
    highlightReadingCells(affected)
  }

  function highlightReadingCells(keys: string[]) {
    for (const key of keys) pasteHighlight.value.add(key)
    pasteHighlight.value = new Set(pasteHighlight.value)
    const timer = setTimeout(() => {
      for (const key of keys) pasteHighlight.value.delete(key)
      pasteHighlight.value = new Set(pasteHighlight.value)
    }, PASTE_HIGHLIGHT_MS)
    highlightTimers.push(timer)
  }

  return {
    isPasteHighlighted,
    editableRowsFor,
    editableCellOrder,
    focusReadingCell,
    handleReadingKeydown,
    handleReadingPaste,
    highlightReadingCells,
    cellKey: billingDraftGridCellKey,
  }
}
