import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourcePath = resolve('app/pages/portal/ui-showcase.vue')

describe('portal component showcase', () => {
  it('uses the tenant layout and is unavailable outside development', () => {
    const source = readFileSync(sourcePath, 'utf8')

    expect(source).toContain("layout: 'tenant'")
    expect(source).toContain('import.meta.dev')
    expect(source).toContain('statusCode: 404')
  })

  it('composes portal component demos with local fixture state', () => {
    const source = readFileSync(sourcePath, 'utf8')
    for (const component of [
      'PortalPullToRefresh', 'PortalButton', 'PortalTextField', 'PortalCard',
      'PortalStatusBadge', 'PortalPaymentRing', 'PortalIdentityImageSlot',
      'PortalSkeleton', 'PortalSpendingChart', 'PortalEmptyState', 'PortalBottomSheet',
    ]) expect(source).toContain(`<${component}`)
    expect(source).toContain('const invoices: TenantInvoiceListItem[]')
  })
})
