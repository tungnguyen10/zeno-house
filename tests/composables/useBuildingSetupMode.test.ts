import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { deriveSetupSteps } from '~/utils/building-setup-steps'

const route = vi.hoisted(() => ({ query: {} as Record<string, string>, hash: '' }))
const router = vi.hoisted(() => ({ replace: vi.fn() }))
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useRouter', () => router)

const missing = { ready: false, missing: ['lessor.full_name', 'terms.notice_days', 'billing.schedule', 'invoice_profile'] as never }
const flow = ref(deriveSetupSteps({
  readiness: { contract: missing, billing: { ready: false, missing: ['billing.schedule', 'invoice_profile'] } },
  building: null, contractProfile: null,
  services: { activeCount: 0, unpricedActiveCount: 0 }, inventory: { itemCount: 0, totalValue: 0 },
  canViewContractProfile: true, canViewInventory: true,
}))

beforeEach(() => {
  vi.clearAllMocks()
  route.query = { setup: '1' }
})

describe('useBuildingSetupMode', () => {
  it('is active only with ?setup=1 and relabels save buttons', async () => {
    const { useBuildingSetupMode } = await import('~/composables/buildings/useBuildingSetupMode')
    const mode = useBuildingSetupMode({ flow, openStep: vi.fn() })
    expect(mode.active.value).toBe(true)
    expect(mode.submitLabel.value).toBe('Lưu và tiếp')

    route.query = {}
    const off = useBuildingSetupMode({ flow, openStep: vi.fn() })
    expect(off.active.value).toBe(false)
    expect(off.submitLabel.value).toBe('Lưu')
  })

  it('opens the next step after saving in setup mode and closes otherwise', async () => {
    const openStep = vi.fn()
    const { useBuildingSetupMode } = await import('~/composables/buildings/useBuildingSetupMode')
    useBuildingSetupMode({ flow, openStep }).afterSave('lessor-profile')
    expect(openStep).toHaveBeenCalledWith('contract-terms')

    route.query = {}
    const closer = vi.fn()
    useBuildingSetupMode({ flow, openStep: closer }).afterSave('lessor-profile')
    expect(closer).toHaveBeenCalledWith(null)
  })

  it('skip moves on without saving; exit drops the query', async () => {
    const openStep = vi.fn()
    const { useBuildingSetupMode } = await import('~/composables/buildings/useBuildingSetupMode')
    const mode = useBuildingSetupMode({ flow, openStep })
    mode.skip('service-defaults')
    expect(openStep).toHaveBeenCalled()
    await mode.exit()
    expect(router.replace).toHaveBeenCalledWith({ query: {}, hash: '' })
  })
})
