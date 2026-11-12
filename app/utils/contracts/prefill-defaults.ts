import dayjs from 'dayjs'

export interface ContractDefaults {
  termMonths: number | null
  depositMonths: number | null
}

export interface ContractCreatePrefs {
  termMonths?: number
  depositMonths?: number
  paymentDueDay?: number | null
  occupantCount?: number
  openBlocks?: string[]
}

const PREFS_KEYS: (keyof ContractCreatePrefs)[] = ['termMonths', 'depositMonths', 'paymentDueDay', 'occupantCount', 'openBlocks']

/** YYYY-MM-DD, start + N months − 1 day (dayjs clamps month-end). */
export function computeEndDate(startDate: string, termMonths: number): string {
  return dayjs(startDate).add(termMonths, 'month').subtract(1, 'day').format('YYYY-MM-DD')
}

/** Deposit = rent × months, rounded to the nearest 1,000. */
export function computeDeposit(monthlyRent: number, depositMonths: number): number {
  return Math.round((monthlyRent * depositMonths) / 1000) * 1000
}

/** Priority: last choice for this building (prefs) > building defaults. */
export function resolveDefaults(building: ContractDefaults, prefs: ContractCreatePrefs | null): ContractDefaults {
  return {
    termMonths: prefs?.termMonths ?? building.termMonths,
    depositMonths: prefs?.depositMonths ?? building.depositMonths,
  }
}

export function applyContractDefaults(
  form: { start_date: string; end_date: string; monthly_rent: string; deposit: string },
  defaults: ContractDefaults,
  touched: Set<string>,
): Partial<{ end_date: string; deposit: string }> {
  const out: Partial<{ end_date: string; deposit: string }> = {}
  if (defaults.termMonths != null && form.start_date && !touched.has('end_date')) {
    out.end_date = computeEndDate(form.start_date, defaults.termMonths)
  }
  const rent = Number(form.monthly_rent)
  if (defaults.depositMonths != null && form.monthly_rent && rent > 0 && !touched.has('deposit')) {
    out.deposit = String(computeDeposit(rent, defaults.depositMonths))
  }
  return out
}

function prefsKey(buildingId: string): string {
  return `contract-create:prefs:${buildingId}`
}

export function loadPrefs(buildingId: string): ContractCreatePrefs | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(prefsKey(buildingId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: ContractCreatePrefs = {}
    for (const key of PREFS_KEYS) {
      if (parsed[key] !== undefined) (result as Record<string, unknown>)[key] = parsed[key]
    }
    return result
  }
  catch {
    return null
  }
}

export function savePrefs(buildingId: string, prefs: ContractCreatePrefs): void {
  if (typeof window === 'undefined') return
  const clean: Record<string, unknown> = {}
  for (const key of PREFS_KEYS) {
    if (prefs[key] !== undefined) clean[key] = prefs[key]
  }
  window.localStorage.setItem(prefsKey(buildingId), JSON.stringify(clean))
}
