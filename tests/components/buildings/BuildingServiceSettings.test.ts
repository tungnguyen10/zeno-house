import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mapServiceCatalog } from '~/utils/mappers/service-catalog'
import BuildingServiceSettings from '~/components/buildings/BuildingServiceSettings.vue'
import type { ServiceCatalogItem } from '~/types/service-catalog'

const stubs = {
  UiInput: { props: ['modelValue'], template: '<input data-test="amount" :value="modelValue" />' },
  UiToggle: true, UiSelect: true, UiBadge: true, UiSkeleton: true, UiEmptyState: true,
}

const catalogItem = (over: Partial<ServiceCatalogItem> = {}): ServiceCatalogItem => ({
  id: 'c-1', code: 'management_fee', name: 'Phí quản lý', buildingId: null, pricingType: 'fixed_per_room',
  unit: null, description: null, isActive: true, isCustom: false, sortOrder: 9, defaultAmount: 200000, ...over,
})

describe('mapServiceCatalog', () => {
  it('maps the suggested default amount as a number', () => {
    const item = mapServiceCatalog({
      id: 'c-1', code: 'management_fee', name: 'Phí quản lý', pricing_type: 'fixed_per_room', unit: null,
      description: null, is_active: true, sort_order: 9, created_at: null, building_id: null, default_amount: '200000' as unknown as number,
    })
    expect(item.defaultAmount).toBe(200000)
  })
})

describe('BuildingServiceSettings suggested price', () => {
  const base = { buildingId: 'b-1', catalog: [catalogItem()] }

  it('shows the catalog suggestion until the building has its own price', () => {
    const w = mount(BuildingServiceSettings, { props: { ...base, services: [] }, global: { stubs } })
    expect((w.find('[data-test="amount"]').element as HTMLInputElement).value).toBe('200000')
  })

  it('prefers the building price once set', () => {
    const w = mount(BuildingServiceSettings, {
      props: { ...base, services: [{ id: 's-1', catalogId: 'c-1', defaultAmount: 150000, isActive: true, pricingType: null }] as never },
      global: { stubs },
    })
    expect((w.find('[data-test="amount"]').element as HTMLInputElement).value).toBe('150000')
  })
})

describe('ServicesStep first-time enable', () => {
  it('seeds the catalog suggestion when creating the building service row', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('app/components/buildings/settings/steps/ServicesStep.vue', 'utf8')
    expect(src).toContain('default_amount: suggestedAmount(catalogId), is_active: isActive')
    expect(src).toContain('default_amount: suggestedAmount(catalogId), pricing_type: pricingType')
  })
})
