import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UserListRow from '~/components/users/UserListRow.vue'
import type { ManagedUserWithAssignments } from '~/types/users'

const row = (assignments = 0): ManagedUserWithAssignments => ({
  user: { id: 'u1', email: 'linh@zeno.test', name: 'Bùi Văn Linh', role: 'owner', createdBy: null },
  assignments: Array.from({ length: assignments }, (_, i) => ({ id: `a${i}`, building_id: `b${i}`, can_delete_master_data: false, building: null }) as never),
})

const stubs = { UiBadge: { template: '<span data-badge><slot /></span>' }, IconChevronRight: true }

describe('UserListRow', () => {
  it('renders identity, initials, role and a missing-building warning', () => {
    const wrapper = mount(UserListRow, { props: { row: row(0), manageable: true }, global: { stubs } })

    expect(wrapper.text()).toContain('BL')
    expect(wrapper.text()).toContain('Bùi Văn Linh')
    expect(wrapper.text()).toContain('linh@zeno.test')
    expect(wrapper.findAll('[data-badge]').map(b => b.text())).toEqual(['Chủ nhà', 'Chưa có tòa'])
  })

  it('shows the building count when assigned', () => {
    const wrapper = mount(UserListRow, { props: { row: row(2), manageable: true }, global: { stubs } })
    expect(wrapper.text()).toContain('2 tòa')
  })

  it('is a button that emits open when manageable', async () => {
    const wrapper = mount(UserListRow, { props: { row: row(1), manageable: true }, global: { stubs } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open')).toEqual([['u1']])
  })

  it('is not interactive when the viewer cannot manage the user', () => {
    const wrapper = mount(UserListRow, { props: { row: row(1), manageable: false }, global: { stubs } })
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
