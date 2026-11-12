const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const UNITS = ['', ' nghìn', ' triệu', ' tỷ']

function readTriple(n: number, full: boolean): string {
  const h = Math.floor(n / 100)
  const t = Math.floor((n % 100) / 10)
  const u = n % 10
  const parts: string[] = []
  if (full || h > 0) parts.push(`${DIGITS[h]} trăm`)
  if (t > 1) {
    parts.push(`${DIGITS[t]} mươi`)
    if (u === 1) parts.push('mốt')
    else if (u === 4) parts.push('tư')
    else if (u === 5) parts.push('lăm')
    else if (u > 0) parts.push(DIGITS[u]!)
  }
  else if (t === 1) {
    parts.push('mười')
    if (u === 5) parts.push('lăm')
    else if (u > 0) parts.push(DIGITS[u]!)
  }
  else if (u > 0) {
    if (full || h > 0) parts.push('lẻ')
    parts.push(DIGITS[u]!)
  }
  return parts.join(' ')
}

export function vndToWords(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0 || amount >= 1e12) throw new Error('Amount must be an integer in [0, 1e12)')
  if (amount === 0) return 'Không đồng'
  const groups: number[] = []
  let rest = amount
  while (rest > 0) {
    groups.push(rest % 1000)
    rest = Math.floor(rest / 1000)
  }
  const words: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]!
    if (g === 0) continue
    words.push(readTriple(g, i < groups.length - 1) + UNITS[i]!)
  }
  const text = words.join(' ').replace(/\s+/g, ' ').trim()
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} đồng`
}
