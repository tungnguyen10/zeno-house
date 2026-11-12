import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useQuickRoomPreview } from '~/composables/buildings/useQuickRoomPreview'

async function setup() {
  const p = useQuickRoomPreview()
  p.enabled.value = true
  p.generator.value = { floorFrom: 1, floorTo: 1, roomsPerFloor: 3, prefix: 'P', startSeq: 101, includeFloor: false, nameFloorStart: 1 }
  p.defaultRent.value = 3_000_000
  await nextTick()
  return p
}

describe('useQuickRoomPreview', () => {
  it('generates rows from the generator', async () => {
    const p = await setup()
    expect(p.rows.value.map(r => r.roomNumber)).toEqual(['P101', 'P102', 'P103'])
    expect(p.rows.value.every(r => r.floor === 1 && r.rent === 3_000_000 && r.area === null && !r.existing && !r.manual)).toBe(true)
  })

  it('keeps manual edits when generator inputs change', async () => {
    const p = await setup()
    p.samePrice.value = false
    p.setCell('P102', 'rent', 4_000_000)
    p.setCell('P102', 'area', 25)
    p.setCell('P102', 'floor', 2)
    p.defaultRent.value = 3_200_000
    p.generator.value = { ...p.generator.value, roomsPerFloor: 4 }
    await nextTick()
    const r = p.rows.value.find(x => x.roomNumber === 'P102')!
    expect(r).toMatchObject({ rent: 4_000_000, area: 25, floor: 2 })
    expect(p.rows.value.find(x => x.roomNumber === 'P101')!.rent).toBe(3_200_000)
    expect(p.rows.value).toHaveLength(4)
  })

  it('samePrice resets manual rent overrides', async () => {
    const p = await setup()
    p.samePrice.value = false
    p.setCell('P101', 'rent', 5_000_000)
    p.samePrice.value = true
    await nextTick()
    expect(p.rows.value.every(r => r.rent === 3_000_000)).toBe(true)
    expect(p.rows.value[0]!.overridden).not.toContain('rent')
  })

  it('resetCell restores the generator floor', async () => {
    const p = await setup()
    p.setCell('P101', 'floor', 3)
    p.resetCell('P101', 'floor')
    expect(p.rows.value[0]).toMatchObject({ floor: 1 })
    expect(p.rows.value[0]!.overridden).not.toContain('floor')
  })

  it('reports local duplicates by slug and builds payload', async () => {
    const p = await setup()
    expect(p.duplicateRoomNumbers.value).toEqual([])
    expect(p.toPayload()).toEqual([
      { room_number: 'P101', floor: 1, monthly_rent: 3_000_000, area: null },
      { room_number: 'P102', floor: 1, monthly_rent: 3_000_000, area: null },
      { room_number: 'P103', floor: 1, monthly_rent: 3_000_000, area: null },
    ])
    p.addRow('p101', 1)
    await nextTick()
    expect(p.duplicateRoomNumbers.value).toContain('p101')
  })

  it('tracks server duplicates until the generator changes', async () => {
    const p = await setup()
    p.markServerDuplicates(['P101'])
    expect(p.serverDuplicates.value).toEqual(['P101'])
    p.generator.value = { ...p.generator.value, prefix: 'A' }
    await nextTick()
    expect(p.serverDuplicates.value).toEqual([])
  })

  it('returns empty rows when disabled', async () => {
    const p = await setup()
    p.enabled.value = false
    await nextTick()
    expect(p.rows.value).toEqual([])
    expect(p.toPayload()).toEqual([])
  })
})

describe('useQuickRoomPreview (PR2)', () => {
  it('flags and excludes existing rooms', async () => {
    const p = await setup()
    p.existingRoomNumbers.value = ['P102']
    await nextTick()
    expect(p.rows.value.find(r => r.roomNumber === 'P102')!.existing).toBe(true)
    expect(p.toPayload().map(r => r.room_number)).toEqual(['P101', 'P103'])
  })

  it('removes and adds rows; manual rows survive regeneration', async () => {
    const p = await setup()
    p.removeRow('P103')
    p.addRow('P105A', 1)
    p.defaultRent.value = 4_000_000
    await nextTick()
    expect(p.rows.value.map(r => r.roomNumber)).toEqual(['P101', 'P102', 'P105A'])
    expect(p.rows.value.find(r => r.roomNumber === 'P105A')!.manual).toBe(true)
  })

  it('surfaces generator errors and clears rows', async () => {
    const p = await setup()
    p.generator.value = { ...p.generator.value, roomsPerFloor: 100 }
    await nextTick()
    expect(p.generatorError.value).toBe('rooms_per_floor')
    expect(p.rows.value.filter(r => !r.manual)).toEqual([])
  })

  it('assigns floors from the generator', async () => {
    const p = await setup()
    p.generator.value = { floorFrom: 2, floorTo: 3, roomsPerFloor: 1, prefix: 'A', startSeq: 1, includeFloor: true, nameFloorStart: 2 }
    await nextTick()
    expect(p.rows.value.map(r => [r.roomNumber, r.floor])).toEqual([['A201', 2], ['A301', 3]])
  })
})
