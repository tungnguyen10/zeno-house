import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import RoomBatchGenerator from '~/components/rooms/RoomBatchGenerator.vue'
import { useQuickRoomPreview } from '~/composables/buildings/useQuickRoomPreview'

describe('RoomBatchGenerator', () => {
  it('groups preview by floor and marks existing rooms', async () => {
    const preview = useQuickRoomPreview()
    preview.enabled.value = true
    preview.generator.value = { floorFrom: 1, floorTo: 2, roomsPerFloor: 2, prefix: 'P', startSeq: 1, includeFloor: true, nameFloorStart: 1 }
    preview.existingRoomNumbers.value = ['P101']
    await nextTick()
    const w = mount(RoomBatchGenerator, { props: { preview } })
    expect(w.findAll('[data-test="floor-group"]')).toHaveLength(2)
    expect(w.find('[data-test="room-row-P101"]').text()).toContain('Đã có')
  })

  it('shows generator error copy', async () => {
    const preview = useQuickRoomPreview()
    preview.enabled.value = true
    preview.generator.value = { floorFrom: 1, floorTo: 1, roomsPerFloor: 100, prefix: 'P', startSeq: 1, includeFloor: true, nameFloorStart: 1 }
    await nextTick()
    const w = mount(RoomBatchGenerator, { props: { preview } })
    expect(w.text()).toContain('Tối đa 99 phòng mỗi tầng')
  })
})
