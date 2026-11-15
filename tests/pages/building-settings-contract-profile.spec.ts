import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/buildings/[id]/settings.vue'), 'utf8')
const step = readFileSync(resolve(process.cwd(), 'app/components/buildings/settings/steps/ContractStep.vue'), 'utf8')

describe('building settings contract profile section', () => {
  it('adds the contract section with readiness badge', () => {
    expect(page).toContain('<template #step-contract-profile>')
    expect(page).toContain('<ContractStep')
    expect(step).toContain('<BuildingContractProfileSettings')
    expect(page).toContain('readiness: readiness.value')
  })

  it('gates editing on the write capability', () => {
    expect(step).toContain(`'building-contract-profile.write'`)
  })
})
