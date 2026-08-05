export function defaultInvoiceDueDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const date = new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day) + 4))
  return date.toISOString().slice(0, 10)
}
