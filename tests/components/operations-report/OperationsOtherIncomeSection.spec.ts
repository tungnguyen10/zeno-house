import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OperationsOtherIncomeSection from '~/components/operations-report/OperationsOtherIncomeSection.vue'
import UiSection from '~/components/ui/UiSection.vue'
import UiTextarea from '~/components/ui/UiTextarea.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'
import type { BuildingOtherIncome } from '~/types/operations-report'

const income = {
  id: 'i1', name: 'Thanh lý máy bơm', amount: 250000, receivedDate: '2026-07-28',
  allocationTarget: 'reserve_fund', payer: 'An', voidedAt: null, updatedAt: '2026-07-28T04:00:00.000Z',
} as BuildingOtherIncome
const defaults = {
  buildingId: 'b1', periodYear: 2026, periodMonth: 7, incomes: [income], total: 250000,
  closed: false, canWrite: true, canVoid: true, canUseReserve: true,
}
function section(props: Partial<typeof defaults> = {}) {
  return mount(OperationsOtherIncomeSection, {
    props: { ...defaults, ...props },
    global: {
      components: { UiSection, UiTextarea, UiEmptyState },
      stubs: {
        OperationsOtherIncomeModal: true,
        UiModal: { props: { open: Boolean }, template: '<div v-if="open"><slot/><slot name="footer"/></div>' },
        UiBadge: true, UiAlert: { template: '<div><slot/></div>' },
        IconPlus: true, IconPencilSquare: true, IconTrash: true, IconSpinner: true,
        UiDropdownMenu: { template: '<div><slot/></div>' }, UiDropdownMenuItem: true,
      },
    },
  })
}
describe('OperationsOtherIncomeSection', () => {
  it('shows the current report rows and hides every mutation in a closed or read-only period', () => {
    for (const props of [{ closed: true }, { canWrite: false, canVoid: false }]) {
      const wrapper = section(props)
      expect(wrapper.text()).toContain('Khoản thu khác của tòa nhà')
      expect(wrapper.text()).toContain(income.name)
      expect(wrapper.text()).not.toContain('Thêm khoản thu')
      expect(wrapper.find('button').exists()).toBe(false)
    }
  })

  it('only allows a writer without reserve permission to change profit entries', async () => {
    const wrapper = section({ canUseReserve: false })
    expect(wrapper.text()).toContain('Thêm khoản thu')
    expect(wrapper.find('button[aria-label^="Sửa"]').exists()).toBe(false)
    await wrapper.setProps({ incomes: [{ ...income, allocationTarget: 'profit' }] })
    expect(wrapper.find('button[aria-label^="Sửa"]').exists()).toBe(true)
  })

  it('requires a reason, sends the displayed version, and refreshes the report after voiding', async () => {
    const request = vi.fn().mockResolvedValue({ data: {} })
    vi.stubGlobal('$fetch', request)
    const wrapper = section()
    await wrapper.get('button[aria-label^="Hủy"]').trigger('click')
    const confirm = wrapper.findAll('button').find(b => b.text() === 'Hủy khoản thu')!
    await confirm.trigger('click')
    expect(request).not.toHaveBeenCalled()
    await wrapper.get('textarea').setValue('Nhập nhầm')
    await confirm.trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('/api/building-other-incomes/i1', expect.objectContaining({
      method: 'DELETE', body: { void_reason: 'Nhập nhầm', expected_updated_at: income.updatedAt },
    }))
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})
