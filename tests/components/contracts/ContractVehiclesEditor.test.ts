import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiInput from '~/components/ui/UiInput.vue'
import ContractVehiclesEditor from '~/components/contracts/ContractVehiclesEditor.vue'

const row = (owner: string, plate: string) => ({ owner_name: owner, plate_number: plate, vehicle_type: null, note: null })

// Register the real UiInput so native <input> elements (and the blur wiring) render;
// stub icon components that are auto-registered only in the app build.
const global = { components: { UiInput }, stubs: { IconSpinner: true, IconTrash: true, IconPlus: true } }

describe('ContractVehiclesEditor', () => {
  it('adds and removes rows', async () => {
    const w = mount(ContractVehiclesEditor, { props: { modelValue: [row('A', '59X1 12345')] }, global })
    await w.find('[data-test="vehicle-add"]').trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)![0]).toHaveLength(2)
    await w.find('[data-test="vehicle-remove-0"]').trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)![0]).toEqual([])
  })

  it('shows a duplicate plate error from the shared schema', () => {
    const w = mount(ContractVehiclesEditor, { props: { modelValue: [row('A', '59X1 12345'), row('B', '59x1 12345')] }, global })
    expect(w.text()).toContain('bị trùng')
  })

  it('normalizes the plate on blur', async () => {
    const w = mount(ContractVehiclesEditor, { props: { modelValue: [row('A', '59x1 12345')] }, global })
    // owner, plate, type, note → plate is the 2nd input.
    await w.findAll('input')[1]!.trigger('blur')
    const last = w.emitted('update:modelValue')!.at(-1)![0] as ReturnType<typeof row>[]
    expect(last[0]!.plate_number).toBe('59X1 12345')
  })
})
