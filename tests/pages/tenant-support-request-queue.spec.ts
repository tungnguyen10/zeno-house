import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = () => readFileSync('app/pages/dashboard/tenant-support-requests.vue', 'utf8')
describe('staff request receiving surface', () => {
  it('guards direct navigation and renders the existing responsive primitives', () => {
    const source = page()
    expect(source).toContain("can('tenants.read')")
    for (const primitive of ['UiListToolbar', 'UiTable', 'UiDrawer', 'UiPagination']) expect(source).toContain(`<${primitive}`)
  })
  it('keeps status handling separate from explicit profile editing', () => {
    const source = page()
    expect(source).toContain('Thông tin hồ sơ không tự động thay đổi')
    expect(source).toContain('Chỉnh sửa hồ sơ')
    expect(source).toContain("can('tenants.update')")
    expect(source).not.toContain('/api/tenants')
    expect(source).toContain('Tệp đính kèm không còn khả dụng')
  })
  it('provides retry, in-flight, stale and long-content states', () => {
    const source = page()
    expect(source).toContain('Thử lại')
    expect(source).toContain('actionError')
    expect(source).toContain(':loading="updating"')
    expect(source).toContain('whitespace-pre-wrap break-words')
    expect(source).toContain('min-w-0')
  })
})
