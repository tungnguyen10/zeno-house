import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/contracts/create.vue'), 'utf8')

describe('contract create page', () => {
  it('is a single page without wizard or confirm step', () => {
    expect(page).not.toContain('<ContractWizardSteps')
    expect(page).not.toContain('currentStep')
    expect(page).not.toContain('ContractCreateConfirm')
  })

  it('renders the four always-open blocks and four collapsible blocks', () => {
    for (const key of ['room', 'tenant', 'terms', 'handover', 'occupants', 'vehicles', 'services', 'inventory']) {
      expect(page).toContain(`data-block="${key}"`)
    }
  })

  it('submits everything in one request (no per-occupant POST)', () => {
    expect(page).not.toContain('Promise.allSettled')
    expect(page).not.toMatch(/\/occupants`,\s*\{\s*method: 'POST'/)
    expect(page).toContain('occupants:')
    expect(page).toContain('vehicles:')
    expect(page).toContain('services:')
  })

  it('offers create and create-and-export, scrolls to first error and opens its block', () => {
    expect(page).toContain('Tạo &amp; xuất DOCX')
    expect(page).toContain('Tạo hợp đồng')
    expect(page).toContain('blockForField(')
    expect(page).toContain('scrollIntoView')
  })

  it('uses server drafts and saves per-building prefs after success', () => {
    expect(page).toContain('useContractCreateDraft(')
    expect(page).toContain('savePrefs(')
  })

  it('no longer preloads all tenants', () => {
    expect(page).not.toContain('allTenantsData')
  })
})
