import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const TOUCH = 'min-h-11 sm:min-h-0'
const SEARCH_TOUCH = '[&_input]:min-h-11 sm:[&_input]:min-h-0'

const source = (file: string) => readFileSync(resolve(file), 'utf8')
const buttons = (src: string) => src.match(/<UiButton\b[^>]*>/g) ?? []

describe('settings touch targets', () => {
  it.each([
    'app/pages/dashboard/settings/tenant-accounts.vue',
    'app/pages/dashboard/settings/profile.vue',
    'app/pages/dashboard/settings/building-settings.vue',
    'app/pages/dashboard/settings/access-requests.vue',
    'app/pages/dashboard/settings/security.vue',
    'app/pages/dashboard/settings/managers.vue',
  ])('%s sizes every page-owned button to 44px below sm', (file) => {
    const found = buttons(source(file))
    expect(found.length).toBeGreaterThan(0)
    expect(found.filter(tag => !tag.includes(TOUCH))).toEqual([])
  })

  it.each([
    'app/pages/dashboard/settings/tenant-accounts.vue',
    'app/pages/dashboard/settings/managers.vue',
  ])('%s sizes the search input to 44px below sm', (file) => {
    const tag = source(file).match(/<UiSearchInput\b[\s\S]*?\/>/)?.[0]
    expect(tag).toContain(SEARCH_TOUCH)
  })

  it.each([
    'access-requests', 'building-settings', 'buildings', 'history',
    'managers', 'profile', 'security', 'tenant-accounts',
  ])('settings/%s hides the inline back link (header arrow covers it)', (name) => {
    const src = source(`app/pages/dashboard/settings/${name}.vue`)
    expect(src).not.toContain('back-mobile-only')
    expect(src).toContain(':back-link="false"')
  })

  it.each([
    'tenant-accounts',
    'access-requests',
  ])('settings/%s uses the shared list pattern instead of a table', (name) => {
    const src = source(`app/pages/dashboard/settings/${name}.vue`)
    expect(src).not.toContain('<UiTable')
    expect(src).toContain('role="list"')
    expect(src).toContain('divide-y divide-ui-border border-y border-ui-border bg-ui-surface sm:mx-0 sm:overflow-hidden sm:rounded-lg sm:border')
    expect(src).toContain('px-4 py-3')
  })

  it.each([
    ['managers', 'Thêm người dùng', 'Thêm'],
    ['tenant-accounts', 'Cấp tài khoản', 'Cấp'],
  ])('settings/%s shortens its primary action below sm without losing the accessible name', (name, full, short) => {
    const tag = source(`app/pages/dashboard/settings/${name}.vue`).match(/<UiButton\b[^>]*aria-label[^>]*>/)?.[0]
    expect(tag).toContain(`aria-label="${full}"`)
    const src = source(`app/pages/dashboard/settings/${name}.vue`)
    expect(src).toContain(`<span class="sm:hidden">${short}</span>`)
    expect(src).toContain(`<span class="hidden sm:inline">${full}</span>`)
  })
})
