import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PortalEmptyState from '~/components/portal/PortalEmptyState.vue'
import PortalSkeleton from '~/components/portal/PortalSkeleton.vue'

const emptyStubs = {
  IconAlertCircle: true,
  IconLayers: true,
  PortalButton: { template: '<button><slot /></button>' },
}

describe('portal feedback states', () => {
  it('announces error states and uses the portal danger treatment', () => {
    const wrapper = mount(PortalEmptyState, {
      props: { title: 'Không tải được dữ liệu', tone: 'error' },
      global: { stubs: emptyStubs },
    })
    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.get('[data-icon]').classes()).toEqual(expect.arrayContaining([
      'bg-portal-danger/10',
      'text-portal-danger',
    ]))
  })

  it('keeps normal empty states calm and non-alerting', () => {
    const wrapper = mount(PortalEmptyState, {
      props: { title: 'Chưa có dữ liệu' },
      global: { stubs: emptyStubs },
    })
    expect(wrapper.attributes('role')).toBeUndefined()
    expect(wrapper.get('[data-icon]').classes()).toContain('bg-smoke-blue')
  })

  it.each([
    ['line', 'h-4'],
    ['card', 'h-24'],
    ['statement', 'h-32'],
    ['avatar', 'size-12'],
  ] as const)('provides a %s skeleton shape', (variant, shapeClass) => {
    const wrapper = mount(PortalSkeleton, { props: { variant } })
    expect(wrapper.classes()).toContain(shapeClass)
    expect(wrapper.attributes('aria-label')).toBe('Đang tải')
  })
})
