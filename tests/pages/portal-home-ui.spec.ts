import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve('app/pages/portal/index.vue'), 'utf8')

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
})
