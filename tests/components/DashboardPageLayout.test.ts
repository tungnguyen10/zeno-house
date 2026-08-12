import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pagePath = resolve(process.cwd(), 'app/pages/dashboard/index.vue')
const source = readFileSync(pagePath, 'utf8')
const globalStyles = readFileSync(resolve(process.cwd(), 'app/assets/scss/main.scss'), 'utf8')

describe('dashboard page composition', () => {
  it('uses surface panels and the adaptive KPI grid', () => {
    expect(source).toContain('md:grid-cols-2')
    expect(source).toContain('lg:grid-cols-3')
    expect(source).toContain('data-dashboard-card="collection"')
    expect(source).toContain('data-dashboard-card="rooms"')
    expect(source).toContain('data-dashboard-card="contracts"')
    expect(source.match(/<UiSurfacePanel/g)?.length ?? 0).toBeGreaterThanOrEqual(6)
  })

  it('keeps the approved mobile reading order', () => {
    const collection = source.indexOf('data-dashboard-card="collection"')
    const rooms = source.indexOf('data-dashboard-card="rooms"')
    const contracts = source.indexOf('data-dashboard-card="contracts"')
    const revenue = source.indexOf('data-dashboard-section="revenue"')
    const occupancy = source.indexOf('data-dashboard-section="occupancy"')
    const pending = source.indexOf('id="pending-operations"')

    expect(collection).toBeGreaterThan(0)
    expect(collection).toBeLessThan(rooms)
    expect(rooms).toBeLessThan(contracts)
    expect(contracts).toBeLessThan(revenue)
    expect(revenue).toBeLessThan(occupancy)
    expect(occupancy).toBeLessThan(pending)
  })

  it('uses the combined revenue overview and exposes the pending anchor', () => {
    expect(source).toContain('<DashboardRevenueOverview')
    expect(source).not.toContain('<DashboardRevenueBreakdown')
    expect(source).toContain('id="pending-operations"')
  })

  it('clips root horizontal overflow without hiding layout defects', () => {
    expect(globalStyles).toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*clip;/s)
  })
})
