import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const card = readFileSync(resolve(process.cwd(), 'app/components/buildings/BuildingCard.vue'), 'utf8')

describe('BuildingCard selection mode', () => {
  it('keeps the checkbox gutter at every breakpoint', () => {
    // `sm:p-4` sets padding-left at sm+, so the gutter must be repeated at sm.
    expect(card).toContain("selectable ? 'pl-12 sm:pl-12' : ''")
  })
})
