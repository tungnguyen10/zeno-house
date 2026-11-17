import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const form = readFileSync(resolve(process.cwd(), 'app/components/buildings/BuildingForm.vue'), 'utf8')
const create = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/buildings/create.vue'), 'utf8')
const basics = readFileSync(resolve(process.cwd(), 'app/components/buildings/settings/steps/BasicsStep.vue'), 'utf8')

describe('BuildingForm variants', () => {
  it('declares a create/basics variant and hides pricing and schedule for create', () => {
    expect(form).toContain("variant?: 'create' | 'basics'")
    expect(form).toContain('v-if="variant === \'basics\'"')
    expect(form).not.toContain('title="Chủ sở hữu"')
  })

  it('create page uses the create variant; basics step uses the basics variant', () => {
    expect(create).toContain('variant="create"')
    expect(basics).toContain('variant="basics"')
  })
})
