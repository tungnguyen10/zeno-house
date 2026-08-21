export interface SharedExpenseAllocationPreviewRow {
  buildingId: string
  amount: number
}

export function buildSharedExpenseAllocationPreview(
  amount: number,
  buildingIds: string[],
): SharedExpenseAllocationPreviewRow[] {
  if (!Number.isFinite(amount) || amount <= 0 || buildingIds.length === 0) return []

  const baseAmount = Math.floor(amount / buildingIds.length)
  return buildingIds.map((buildingId, index) => ({
    buildingId,
    amount: index === buildingIds.length - 1
      ? baseAmount + amount - baseAmount * buildingIds.length
      : baseAmount,
  }))
}
