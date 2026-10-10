import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve('supabase/migrations/20261010140000_checkout_per_person_utilities.sql'), 'utf8')

describe('checkout per-person utility migration', () => {
  it('replaces the three RPCs instead of creating duplicates', () => {
    for (const fn of ['preview', 'get', 'return']) {
      expect(migration).toMatch(new RegExp(`create or replace function public\\.contract_checkout_${fn}\\b`, 'i'))
    }
    expect(migration).not.toMatch(/^create function/im)
  })

  it('exposes live building pricing so the client can hide meter inputs before a draft exists', () => {
    expect(migration).toMatch(/select bl\.\* into b from public\.buildings bl join public\.contracts ct on ct\.building_id=bl\.id where ct\.id=p_contract_id/i)
    expect(migration).toMatch(/'buildingPricing',case when b\.id is null then null else jsonb_build_object\('electricityPricingType',b\.electricity_pricing_type,'waterPricingType',b\.water_pricing_type/i)
  })

  it('freezes an occupant count that matches the monthly per-person billing rule', () => {
    expect(migration).toMatch(/'occupantCount',greatest\(\(select count\(\*\) from public\.contract_occupants o where o\.contract_id=c\.id and o\.billing_counted/i)
    expect(migration).toMatch(/o\.move_out_date is null or o\.move_out_date>=date_trunc\('month',h\.actual_return_date\)::date\)\),c\.occupant_count\)/i)
    expect(migration).not.toMatch(/'occupantCount',c\.occupant_count/i)
  })

  it('only persists a handover_out reading for usage-based pricing', () => {
    expect(migration).toMatch(/if pricing in \('per_kwh','per_m3','tiered'\) and input is not null and input<>'null'::jsonb then/i)
    expect(migration).not.toMatch(/\n if input is not null and input<>'null'::jsonb then/)
  })

  it('labels per-person and fixed utility charges like monthly billing does', () => {
    expect(migration).toContain("then 'Tiền nước (theo người)' else 'Tiền nước (cố định)' end")
    expect(migration).toContain("then 'Tiền điện (theo người)' else 'Tiền điện (cố định)' end")
  })

  it('keeps the closing reading mandatory for metered buildings', () => {
    expect(migration).toMatch(/if pricing in \('per_kwh','per_m3','tiered'\) then[\s\S]*CHECKOUT_READING_REQUIRED/i)
    expect(migration).toContain('CHECKOUT_READING_BELOW_BASELINE')
    expect(migration).toContain('CHECKOUT_READING_CONFLICT')
  })
})
