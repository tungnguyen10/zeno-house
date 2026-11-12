import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/buildings/[id]/settings.vue'), 'utf8')

describe('building settings contract profile section', () => {
  it('adds the contract section with readiness badge', () => {
    expect(page).toContain(`id: 'contract-profile'`)
    expect(page).toContain('<section')
    expect(page).toContain('id="contract-profile"')
    expect(page).toContain('<BuildingContractProfileSettings')
    expect(page).toContain('readiness.contract.ready')
  })

  it('gates editing on the write capability', () => {
    expect(page).toContain(`'building-contract-profile.write'`)
  })
})
