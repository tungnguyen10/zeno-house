import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve('app/pages/portal/index.vue'), 'utf8')
const spec = readFileSync(resolve('openspec/specs/tenant-portal-ui/spec.md'), 'utf8')

describe('portal home refreshed statement UI', () => {
  it('uses the shared portal page and type rhythm', () => {
    expect(page).toContain('space-y-5 px-4 py-5')
    expect(page).toContain('portal-type-display')
    expect(page).toContain('portal-type-heading')
    expect(page).toContain('portal-type-caption')
  })

  it('renders the latest invoice as a status-accented money statement', () => {
    expect(page).toContain(':accent="portalInvoiceStatementAccent(latest.status)"')
    expect(page).toContain('portal-money')
    expect(page).toContain('formatCurrencyNumber(latest.balanceAmount)')
    expect(page).toContain('class="portal-money-unit"')
  })

  it('uses the statement skeleton shape while the hero is loading', () => {
    expect(page).toContain('<PortalSkeleton v-if="loading" variant="statement"')
  })

  it('labels roommate access and names the primary tenant', () => {
    expect(page).toContain("contract.assignmentRole === 'roommate'")
    expect(page).toContain('Người ở cùng')
    expect(page).toContain('Người đứng hợp đồng: {{ contract.primaryTenantName }}')
  })

  it('places the financial overview before quick actions', () => {
    expect(page).toContain('const financialOverview = computed')
    expect(page).toContain('Bình quân mỗi tháng')
    expect(page).toContain('Tỷ lệ đã thanh toán')
    expect(page).toContain('grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')
    expect(page).toContain('text-[color:var(--portal-positive-ink)]')
    expect(page.indexOf('Financial overview')).toBeLessThan(page.indexOf('Quick actions'))
  })

  it('records the financial overview behavior in the accepted portal spec', () => {
    expect(spec).toContain('### Requirement: Tenant financial overview')
    expect(spec).toContain('up to the six newest invoice periods in chronological order')
    expect(spec).toContain(
      'the chart displays each period’s total invoice value as one vertical bar',
    )
    expect(spec).not.toContain(
      'the chart distinguishes total invoice value from paid value',
    )
    expect(spec).toContain('chart animation is disabled')
  })
})
