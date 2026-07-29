import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve('app/pages/portal/room.vue'), 'utf8')

describe('portal room refreshed UI', () => {
  it('uses the shared portal rhythm and type roles', () => {
    expect(page).toContain('space-y-5 px-4 py-5')
    expect(page).toContain('portal-type-heading')
    expect(page).toContain('portal-type-body')
    expect(page).toContain('portal-type-caption')
  })

  it('presents lease terms as clean divider-separated rows', () => {
    expect(page).toContain('<dl class="divide-y divide-border-light">')
    expect(page).toContain('Điều khoản chính')
    expect(page).toContain('portal-money')
    expect(page).toContain('Tiền thuê hàng tháng')
    expect(page).toContain('Tiền cọc')
    expect(page).toContain('Ngày thanh toán')
    expect(page).toContain('Số người ở')
  })

  it('only renders contract adjustments when the signed terms include them', () => {
    expect(page).toContain('contract.discountAmount !== 0')
    expect(page).toContain('contract.surchargeAmount !== 0')
    expect(page).toContain('contract.notes')
    expect(page).toContain('Điều chỉnh hợp đồng')
  })

  it('matches loading placeholders to the room summary and lease terms', () => {
    expect(page).toContain('variant="statement"')
    expect(page).toContain('variant="card"')
  })

  it('explains roommate access without implying contract ownership', () => {
    expect(page).toContain("contract.assignmentRole === 'roommate'")
    expect(page).toContain('Người ở cùng')
    expect(page).toContain('Người đứng hợp đồng')
    expect(page).toContain('contract.primaryTenantName')
  })
})
