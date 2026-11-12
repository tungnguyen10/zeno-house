import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import RoomBatchGenerator from '~/components/rooms/RoomBatchGenerator.vue'
import QuickRoomCellEditor from '~/components/buildings/QuickRoomCellEditor.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiAlert from '~/components/ui/UiAlert.vue'
import { useQuickRoomPreview } from '~/composables/buildings/useQuickRoomPreview'

const icon = defineComponent({ template: '<span />' })
const global = { components: { UiInput, UiBadge, UiAlert, QuickRoomCellEditor, IconX: icon, IconPlus: icon, IconRefresh: icon } }

describe('RoomBatchGenerator', () => {
  it('groups preview by floor and marks existing rooms', async () => {
    const preview = useQuickRoomPreview()
    preview.enabled.value = true
    preview.generator.value = { floorFrom: 1, floorTo: 2, roomsPerFloor: 2, prefix: 'P', startSeq: 1, includeFloor: true, nameFloorStart: 1 }
    preview.existingRoomNumbers.value = ['P101']
    await nextTick()
    const w = mount(RoomBatchGenerator, { props: { preview }, global })
    expect(w.findAll('[data-test="floor-group"]')).toHaveLength(2)
    expect(w.find('[data-test="room-row-P101"]').text()).toContain('Đã có')
  })

  it('shows generator error copy', async () => {
    const preview = useQuickRoomPreview()
    preview.enabled.value = true
    preview.generator.value = { floorFrom: 1, floorTo: 1, roomsPerFloor: 100, prefix: 'P', startSeq: 1, includeFloor: true, nameFloorStart: 1 }
    await nextTick()
    const w = mount(RoomBatchGenerator, { props: { preview }, global })
    expect(w.text()).toContain('Tối đa 99 phòng mỗi tầng')
  })
})
