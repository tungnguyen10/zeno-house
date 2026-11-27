import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import Page from '~/pages/dashboard/settings/history.vue'
import type { AuditEvent } from '~/types/audit'

const event = (overrides: Partial<AuditEvent>): AuditEvent => ({
  id: 'evt-1',
  buildingId: 'b1',
  actorId: 'u1',
  action: 'room.updated',
  entityType: 'room',
  entityId: 'e1',
  correlationId: null,
  operationId: null,
  buildingNameSnapshot: null,
  buildingCodeSnapshot: null,
  beforeData: null,
  afterData: null,
  metadata: {},
  createdAt: new Date().toISOString(),
  ...overrides,
})

const events = ref<AuditEvent[]>([])

const stubs = {
  UiPageHeader: { template: '<header><slot /></header>' },
  UiToolbar: { template: '<div><slot /><slot name="actions" /></div>' },
  UiSelect: true,
  UiFilterResetButton: true,
  UiSkeleton: true,
  UiEmptyState: true,
  UiButton: { template: '<button><slot /></button>' },
  UiBadge: { template: '<span data-badge><slot /></span>' },
}

beforeEach(() => {
  events.value = [
    event({
      id: 'evt-1',
      action: 'reserve_fund.accrual_refreshed',
      entityType: 'reserve_fund',
      entityLabel: 'Quỹ tòa A',
      actorName: 'Tùng Nguyễn',
      actorEmail: 'tung@zeno.test',
    }),
    event({
      id: 'evt-2',
      action: 'building_service.updated',
      entityType: 'building_service',
      entityLabel: 'water_input',
      entitySubLabel: 'water_input',
      actorName: 'Tùng Nguyễn',
      actorEmail: 'tung@zeno.test',
    }),
  ]
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  vi.stubGlobal('useAuthStore', () => ({ isAdmin: true }))
  vi.stubGlobal('useAuditHistory', () => ({
    buildingId: ref(''),
    entityType: ref(''),
    buildings: ref([]),
    events,
    total: ref(2),
    isLoading: ref(false),
    isLoadingMore: ref(false),
    hasMore: ref(false),
    loadMore: vi.fn(),
    error: ref(null),
    refresh: vi.fn(),
  }))
})

describe('settings history page rendering', () => {
  it('reads each event as a sentence led by the actor', async () => {
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()
    const text = wrapper.text().replace(/\s+/g, ' ')

    expect(text).toContain('Tùng Nguyễn cập nhật quỹ dự phòng Quỹ tòa A')
    expect(text).not.toContain('tung@zeno.test')
  })

  it('never shows technical snake_case keys', async () => {
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('water_input')
  })

  it('does not render the redundant action badge', async () => {
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    expect(wrapper.find('[data-badge]').exists()).toBe(false)
  })
})
