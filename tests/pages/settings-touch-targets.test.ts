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
})
