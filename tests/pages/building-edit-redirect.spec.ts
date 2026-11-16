import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import EditPage from '~/pages/dashboard/buildings/[id]/edit.vue'
import { buildingEditPath, buildingSettingsPath } from '~/utils/routes/operational'

describe('building edit route', () => {
  it('redirects /edit to the basics step of settings', async () => {
    const navigate = vi.fn(async () => {})
    vi.stubGlobal('navigateTo', navigate)
    vi.stubGlobal('useRoute', () => ({ params: { id: 'qa-v2-flow' } }))

    mount(defineComponent({ render: () => h(Suspense, null, { default: () => h(EditPage) }) }))
    await flushPromises()

    expect(navigate).toHaveBeenCalledWith('/dashboard/buildings/qa-v2-flow/settings#basics', { replace: true })
  })

  it('points edit links at the settings basics step', () => {
    const building = { id: 'b-1', slug: 'qa-v2-flow' }

    expect(buildingEditPath(building)).toBe(`${buildingSettingsPath(building)}#basics`)
  })
})
