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

  it('never coerces blank handover readings to 0 and prefills them from the latest reading', () => {
    expect(page).not.toMatch(/handover_(electricity|water)_reading: Number\(/)
    expect(page).toContain("form.value.handover_electricity_reading === '' ? undefined")
    expect(page).toContain('/api/meter-readings/latest')
  })

  it('docks the mobile action bar above the tab bar via form mode', () => {
    expect(page).toContain('useAppFormMode()')
    expect(page).toContain('formMode.value = true')
    expect(page).toContain('formMode.value = false')
    expect(page).not.toContain('bottom-0 z-20')
  })

  it('uses server drafts and saves per-building prefs after success', () => {
    expect(page).toContain('useContractCreateDraft(')
    expect(page).toContain('savePrefs(')
  })

  it('no longer preloads all tenants', () => {
    expect(page).not.toContain('allTenantsData')
  })

  it('ignores stale async prefill responses after the room changes', () => {
    for (const guard of ['readinessGuard', 'prefillGuard', 'readingsGuard', 'inventoryGuard']) {
      expect(page).toContain(`const ${guard} = createLatestGuard()`)
    }
    expect(page.match(/if \(!isLatest\(\)\) return/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('loads building profile and services in parallel', () => {
    expect(page).toContain('Promise.all([')
    expect(page).toContain('/contract-profile')
    expect(page).toContain('/api/building-services?building_id=')
  })

  it('refreshes rent when switching rooms inside the same building', () => {
    expect(page).toContain('selectedRoom.value?.id] as const')
  })

  it('searches rooms on the server instead of truncating at the list limit', () => {
    expect(page).toContain('remote-search')
    expect(page).toContain('@search="onRoomSearch"')
    expect(page).toContain('pickedRoom')
  })
})
