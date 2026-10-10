export interface BillingSortableItem {
  floor?: number | null
  roomNumber?: string | null
  contractCode?: string | null
  invoiceCode?: string | null
  contractId?: string | null
  id?: string | null
}

const naturalCollator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' })

function compareNullableText(a?: string | null, b?: string | null): number {
  if (a == null) return b == null ? 0 : 1
  if (b == null) return -1
  return naturalCollator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0)
}

function compareNullableId(a?: string | null, b?: string | null): number {
  if (a == null) return b == null ? 0 : 1
  if (b == null) return -1
  return a < b ? -1 : a > b ? 1 : 0
}

export function compareBillingItems(a: BillingSortableItem, b: BillingSortableItem): number {
  const byFloor = (a.floor ?? Number.MAX_SAFE_INTEGER) - (b.floor ?? Number.MAX_SAFE_INTEGER)
  if (byFloor !== 0) return byFloor

  return compareNullableText(a.roomNumber, b.roomNumber)
    || compareNullableText(a.contractCode, b.contractCode)
    || compareNullableText(a.invoiceCode, b.invoiceCode)
    || compareNullableId(a.contractId, b.contractId)
    || compareNullableId(a.id, b.id)
}
