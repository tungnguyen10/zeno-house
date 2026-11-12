import { describe, expect, it } from 'vitest'
import { applyContractDefaults, computeDeposit, computeEndDate, loadPrefs, resolveDefaults, savePrefs } from '~/utils/contracts/prefill-defaults'

describe('contract defaults', () => {
  it('end date = start + N months - 1 day, month-end safe', () => {
    expect(computeEndDate('2026-12-01', 12)).toBe('2027-11-30')
    expect(computeEndDate('2027-01-31', 1)).toBe('2027-02-27')
  })

  it('deposit rounds to thousand', () => {
    expect(computeDeposit(3_333_333, 1.5)).toBe(5_000_000)
  })

  it('does not override touched fields', () => {
    const form = { start_date: '2026-12-01', end_date: '2027-06-30', monthly_rent: '3000000', deposit: '' }
    expect(applyContractDefaults(form, { termMonths: 12, depositMonths: 1 }, new Set(['end_date']))).toEqual({ deposit: '3000000' })
  })

  it('skips when defaults or inputs missing', () => {
    const form = { start_date: '', end_date: '', monthly_rent: '', deposit: '' }
    expect(applyContractDefaults(form, { termMonths: 12, depositMonths: 1 }, new Set())).toEqual({})
    expect(applyContractDefaults({ ...form, start_date: '2026-12-01' }, { termMonths: null, depositMonths: null }, new Set())).toEqual({})
  })

  it('last choice for the building beats building defaults', () => {
    expect(resolveDefaults({ termMonths: 12, depositMonths: 1 }, { termMonths: 6 })).toEqual({ termMonths: 6, depositMonths: 1 })
    expect(resolveDefaults({ termMonths: 12, depositMonths: 1 }, null)).toEqual({ termMonths: 12, depositMonths: 1 })
  })

  it('prefs round-trip through localStorage without extra keys', () => {
    savePrefs('b-1', { termMonths: 6, depositMonths: 2, openBlocks: ['vehicles'] })
    expect(loadPrefs('b-1')).toEqual({ termMonths: 6, depositMonths: 2, openBlocks: ['vehicles'] })
    expect(Object.keys(JSON.parse(window.localStorage.getItem('contract-create:prefs:b-1')!))).toEqual(['termMonths', 'depositMonths', 'openBlocks'])
  })
})
