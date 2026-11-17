import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('contract profile split into two steps', () => {
  const lessor = read('app/components/buildings/BuildingLessorProfileForm.vue')
  const terms = read('app/components/buildings/BuildingContractTermsForm.vue')

  it('lessor form holds identity and contact only, including email', () => {
    expect(lessor).toContain('title="Danh tính"')
    expect(lessor).toContain('title="Liên hệ"')
    expect(lessor).toContain('lessor_email')
    expect(lessor).not.toContain('notice_days')
    expect(lessor).not.toContain('khác với thông tin liên hệ chủ nhà')
  })

  it('terms form holds no personal data and starts from suggestions', () => {
    for (const pii of ['lessor_id_number', 'lessor_date_of_birth', 'lessor_permanent_address']) expect(terms).not.toContain(pii)
    expect(terms).toContain('contractTermsInitialValues(')
  })

  it('both forms save through PATCH with only their own keys', () => {
    const lessorStep = read('app/components/buildings/settings/steps/LessorProfileStep.vue')
    const termsStep = read('app/components/buildings/settings/steps/ContractTermsStep.vue')
    expect(lessorStep).toContain('patch(')
    expect(termsStep).toContain('patch(')
  })
})
