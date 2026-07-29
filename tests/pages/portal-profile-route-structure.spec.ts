import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('portal profile route structure', () => {
  it('keeps view and edit as sibling pages instead of a nested parent route', () => {
    expect(existsSync(resolve('app/pages/portal/profile.vue'))).toBe(false)
    expect(existsSync(resolve('app/pages/portal/profile/index.vue'))).toBe(true)
    expect(existsSync(resolve('app/pages/portal/profile/edit.vue'))).toBe(true)
  })
})
