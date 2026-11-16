import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import AdvancedSection from '~/components/buildings/settings/AdvancedSection.vue'
import SettingsStepList from '~/components/buildings/settings/SettingsStepList.vue'
import {
  createBuildingSettingsSource,
  provideBuildingSettingsSource,
  useBuildingSettingsSource,
} from '~/composables/buildings/useBuildingSettingsSource'
import { deriveAdvancedSteps } from '~/utils/building-setup-steps'

const Probe = (name: string) => defineComponent({ setup() { return () => h('div', { 'data-test': name }) } })

const stubs = {
  UiBadge: defineComponent({ setup(_, { slots }) { return () => h('span', slots.default?.()) } }),
  IconCheckSmall: true,
  IconChevronDown: true,
}

const mountAdvanced = (canViewFinanceRules: boolean, openId: string | null) => mount(AdvancedSection, {
  props: {
    steps: deriveAdvancedSteps({ buildingCode: 'qav2', managerCount: 1, canViewFinanceRules, financeRuleCount: 2, contractCount: 3 }),
    openId,
  },
  global: {
    components: {
      SettingsStepList,
      IdentityAccessSection: Probe('identity'),
      FinanceRulesSection: Probe('finance'),
      ServiceOverridesSection: Probe('overrides'),
    },
    stubs,
  },
})

describe('AdvancedSection', () => {
  it('renders the heading and every group collapsed by default', () => {
    const w = mountAdvanced(true, null)

    expect(w.text()).toContain('Nâng cao')
    expect(w.findAll('li')).toHaveLength(3)
    expect(w.find('[data-test="identity"]').exists()).toBe(false)
  })

  it('shows only the group that is open', () => {
    const w = mountAdvanced(true, 'finance-rules')

    expect(w.find('[data-test="finance"]').exists()).toBe(true)
    expect(w.find('[data-test="identity"]').exists()).toBe(false)
  })

  it('leaves out finance rules when the user cannot see them', () => {
    const w = mountAdvanced(false, null)

    expect(w.findAll('li').map(li => li.element.id)).toEqual(['identity-access', 'service-overrides'])
  })

  it('forwards open and close requests', async () => {
    const w = mountAdvanced(true, null)
    await w.get('[data-test="step-toggle-service-overrides"]').trigger('click')

    expect(w.emitted('update:openId')![0]).toEqual(['service-overrides'])
  })
})

describe('building settings source', () => {
  const asyncData = () => ({
    data: ref({
      data: {
        building: { id: 'b-1', code: 'qav2' },
        managers: [{ id: 'm-1' }],
        contracts: [{ id: 'c-1', room: { roomNumber: '101' }, tenant: { fullName: 'Le Thi QA Mot' } }],
      },
    }),
    status: ref('success'),
    error: ref(undefined),
    refresh: async () => {},
  })

  it('derives the building, contract rows and managers from the bootstrap payload', () => {
    const source = createBuildingSettingsSource('qa', asyncData() as never)

    expect(source.id).toBe('qa')
    expect(source.building.value).toMatchObject({ code: 'qav2' })
    expect(source.contractRows.value).toEqual([{ contractId: 'c-1', roomNumber: '101', tenantName: 'Le Thi QA Mot' }])
    expect(source.assignedManagers.value).toHaveLength(1)
  })

  it('falls back to empty values before the data loads', () => {
    const empty = asyncData()
    empty.data.value = null as never
    const source = createBuildingSettingsSource('qa', empty as never)

    expect(source.settings.value).toBeNull()
    expect(source.building.value).toBeNull()
    expect(source.contractRows.value).toEqual([])
    expect(source.assignedManagers.value).toEqual([])
  })

  it('injects what the page provided', () => {
    const source = createBuildingSettingsSource('qa', asyncData() as never)
    let injected: unknown
    mount(defineComponent({
      setup() {
        provideBuildingSettingsSource(source)
        return () => h(defineComponent({ setup() { injected = useBuildingSettingsSource(); return () => null } }))
      },
    }))

    expect(injected).toBe(source)
  })

  it('fails loudly when no page provides the source', () => {
    expect(() => mount(defineComponent({ setup() { useBuildingSettingsSource(); return () => null } }))).toThrow(/provideBuildingSettingsSource/)
  })
})
