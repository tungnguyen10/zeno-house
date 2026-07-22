import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const useFetch = vi.fn(() => ({
  data: ref(null),
  status: ref('success'),
  error: ref(null),
  refresh: vi.fn(),
}))
vi.stubGlobal('useFetch', useFetch)
vi.stubGlobal('toValue', (value: unknown) => value)

describe('useBuildingSettingsBootstrap', () => {
  it('uses one keyed SSR request for the complete settings workspace', async () => {
    const { useBuildingSettingsBootstrap } = await import('../../app/composables/buildings/useBuildingSettingsBootstrap')

    useBuildingSettingsBootstrap('toa-a')

    expect(useFetch).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ key: expect.any(Function) }),
    )
    expect((useFetch.mock.calls[0]![0] as () => string)()).toBe('/api/buildings/toa-a/settings-bootstrap')
    expect((useFetch.mock.calls[0]![1].key as () => string)()).toBe('building-settings:toa-a')
  })
})
