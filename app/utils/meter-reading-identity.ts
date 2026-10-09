/** Monthly readings belong to a room period; handovers belong to one tenancy. */
export function meterReadingIdentity(row: {
  room_id: string
  contract_id?: string | null
  meter_type: string
  reading_type: string
  period_year: number
  period_month: number
}): string {
  if (row.reading_type !== 'monthly' && row.contract_id) {
    return `${row.contract_id}:${row.meter_type}:${row.reading_type}`
  }
  return `${row.room_id}:${row.meter_type}:${row.period_year}:${row.period_month}:${row.reading_type}`
}
