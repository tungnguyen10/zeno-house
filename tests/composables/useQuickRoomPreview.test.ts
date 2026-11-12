import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'
import { useQuickRoomPreview } from '~/composables/buildings/useQuickRoomPreview'

const scopes: EffectScope[] = []

afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
})

async function setup() {
  const scope = effectScope()
  scopes.push(scope)
  const p = scope.run(() => useQuickRoomPreview())!
  p.enabled.value = true
  p.generator.value = { floorFrom: 1, floorTo: 1, roomsPerFloor: 3, prefix: 'P', startSeq: 101, includeFloor: false, nameFloorStart: 1 }
  p.defaultRent.value = 3_000_000
  await nextTick()
  return p
}

describe('useQuickRoomPreview', () => {
  it('generates rows from generator inputs', async () => {
    const p = await setup()
    expect(p.rows.value.map(r => r.roomNumber)).toEqual(['P101', 'P102', 'P103'])
    expect(p.rows.value.every(r => r.floor === 1 && r.rent === 3_000_000 && r.area === null)).toBe(true)
  })

  it('keeps manual edits when generator inputs change', async () => {
    const p = await setup()
    p.samePrice.value = false
    p.setCell('P102', 'rent', 4_000_000)
    p.setCell('P102', 'area', 25)
    p.setCell('P102', 'floor', 2)
    p.defaultRent.value = 3_200_000
    p.generator.value.roomsPerFloor = 4
    await nextTick()
    const r = p.rows.value.find(x => x.roomNumber === 'P102')!
    expect(r).toMatchObject({ rent: 4_000_000, area: 25, floor: 2 })
    expect(p.rows.value.find(x => x.roomNumber === 'P101')!.rent).toBe(3_200_000)
    expect(p.rows.value).toHaveLength(4)
  })

  it('drops edits for rooms that leave the range', async () => {
    const p = await setup()
    p.setCell('P103', 'area', 30)
    p.generator.value.roomsPerFloor = 2
    await nextTick()
    p.generator.value.roomsPerFloor = 3
    await nextTick()
    expect(p.rows.value.find(x => x.roomNumber === 'P103')!.area).toBeNull()
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

  it('resetCell restores the default', async () => {
    const p = await setup()
    p.setCell('P101', 'floor', 3)
    p.resetCell('P101', 'floor')
    expect(p.rows.value[0]).toMatchObject({ floor: 1 })
    expect(p.rows.value[0]!.overridden).not.toContain('floor')
  })

  it('rejects invalid generation instead of silently clamping it', async () => {
    const p = await setup()
    p.generator.value.roomsPerFloor = 100
    await nextTick()
    expect(p.generatorError.value).toBe('rooms_per_floor')
    expect(p.rows.value).toEqual([])
  })

  it('reports local duplicates by slug and builds payload', async () => {
    const p = await setup()
    p.generator.value.prefix = ''
    p.generator.value.startSeq = 1
    p.generator.value.roomsPerFloor = 2
    await nextTick()
    expect(p.duplicateRoomNumbers.value).toEqual([])
    expect(p.toPayload()).toEqual([
      { room_number: '01', floor: 1, monthly_rent: 3_000_000, area: null },
      { room_number: '02', floor: 1, monthly_rent: 3_000_000, area: null },
    ])
  })

  it('tracks server duplicates until generator changes', async () => {
    const p = await setup()
    p.markServerDuplicates(['P101'])
    expect(p.serverDuplicates.value).toEqual(['P101'])
    p.generator.value.prefix = 'A'
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

describe('quick room preview reactive lifecycle', () => {
  it('keeps only edits for retained identities when shifting the range', async () => {
    const p = await setup()
    p.setCell('P101', 'area', 20)
    p.setCell('P102', 'area', 25)
    p.generator.value.startSeq = 102
    await nextTick()
    expect(p.rows.value.map(row => row.roomNumber)).toEqual(['P102', 'P103', 'P104'])
    expect(p.rows.value[0]).toMatchObject({ area: 25, overridden: ['area'] })
    p.generator.value.startSeq = 101
    await nextTick()
    expect(p.rows.value[0]).toMatchObject({ area: null, overridden: [] })
  })

  it('resetCell uses the current defaults and removes only that override', async () => {
    const p = await setup()
    p.setCell('P101', 'area', 25)
    p.setCell('P101', 'floor', 3)
    p.defaultArea.value = 18
    p.generator.value.floorFrom = 2
    p.generator.value.floorTo = 2
    await nextTick()
    expect(p.rows.value[0]).toMatchObject({ area: 25, floor: 3 })
    expect(p.rows.value[1]).toMatchObject({ area: 18, floor: 2 })
    p.resetCell('P101', 'area')
    expect(p.rows.value[0]).toMatchObject({ area: 18, floor: 3, overridden: ['floor'] })
    p.setCell('P101', 'area', null)
    await nextTick()
    expect(p.rows.value[0]!.area).toBeNull()
  })

  it('clears rent overrides when same-price is enabled and disabled in one tick', async () => {
    const p = await setup()
    p.samePrice.value = false
    await nextTick()
    p.setCell('P101', 'rent', 5_000_000)
    p.setCell('P101', 'area', 25)
    p.samePrice.value = true
    p.samePrice.value = false
    await nextTick()
    expect(p.rows.value[0]).toMatchObject({ rent: 3_000_000, area: 25, overridden: ['area'] })
  })

  it('keeps server duplicates on cell/default changes and clears them on generator changes', async () => {
    const p = await setup()
    for (const change of [
      () => { p.generator.value.startSeq++ },
      () => { p.generator.value.roomsPerFloor++ },
      () => { p.generator.value.prefix = 'A' },
      () => { p.enabled.value = false },
    ]) {
      p.markServerDuplicates(['P101'])
      p.defaultRent.value++
      p.setCell('P101', 'floor', 2)
      await nextTick()
      expect(p.serverDuplicates.value).toEqual(['P101'])
      change()
      await nextTick()
      expect(p.serverDuplicates.value).toEqual([])
    }
  })

  it('detects repeated slugs across case, accents and punctuation reactively', async () => {
    const p = await setup()
    // rows is writable for restored/edited previews, even though generator numbers are unique.
    p.rows.value = ['Phòng 101', 'PHONG-101', 'phong 101', 'P102'].map(roomNumber => ({
      roomNumber, floor: 1, rent: 0, area: null, overridden: [], existing: false, manual: false,
    }))
    expect(p.duplicateRoomNumbers.value).toEqual(['PHONG-101', 'phong 101'])
    p.rows.value[1]!.roomNumber = 'P103'
    p.rows.value[2]!.roomNumber = 'P104'
    expect(p.duplicateRoomNumbers.value).toEqual([])
  })

  it.each([-5, 2.9, NaN, Infinity])('keeps invalid input %s explicit while disabled', async (value) => {
    const p = await setup()
    p.enabled.value = false
    p.generator.value.roomsPerFloor = value
    await nextTick()
    expect(p.generator.value.roomsPerFloor).toBe(value)
    expect(p.rows.value).toEqual([])
    p.enabled.value = true
    await nextTick()
    expect(p.generatorError.value).toBe('rooms_per_floor')
    expect(p.rows.value).toEqual([])
  })

  it('ignores edits to missing rooms and maps edited values without override metadata', async () => {
    const p = await setup()
    p.samePrice.value = false
    p.setCell('missing', 'floor', 2)
    p.resetCell('missing', 'area')
    p.setCell('P101', 'rent', 4_000_000)
    p.setCell('P101', 'floor', 2)
    p.setCell('P101', 'area', 25)
    expect(p.toPayload()[0]).toEqual({ room_number: 'P101', floor: 2, monthly_rent: 4_000_000, area: 25 })
  })
})

describe('floor generation and manual preview rows', () => {
  it('uses stored floors independently from name floors and resets to current generated floors', async () => {
    const p = await setup()
    p.generator.value = { ...p.generator.value, floorFrom: 2, floorTo: 3, roomsPerFloor: 1, startSeq: 1, includeFloor: true, nameFloorStart: 0 }
    await nextTick()
    expect(p.rows.value.map(r => [r.roomNumber, r.floor])).toEqual([['P001', 2], ['P101', 3]])
    p.setCell('P101', 'floor', 10)
    p.resetCell('P101', 'floor')
    expect(p.rows.value[1]!.floor).toBe(3)
  })

  it('flags and excludes existing names using persistence slug normalization', async () => {
    const p = await setup()
    p.generator.value.prefix = 'Phòng '
    p.existingRoomNumbers.value = ['PHONG-102']
    p.markServerDuplicates(['Phòng 102', 'Phòng 101'])
    await nextTick()
    p.markServerDuplicates(['Phòng 102', 'Phòng 101'])
    p.existingRoomNumbers.value = ['PHONG-102', 'PHONG-101']
    await nextTick()
    expect(p.rows.value.map(r => r.existing)).toEqual([true, true, false])
    expect(p.toPayload().map(r => r.room_number)).toEqual(['Phòng 103'])
    expect(p.serverDuplicates.value).toEqual([])
    p.existingRoomNumbers.value = []
    await nextTick()
    expect(p.rows.value.every(r => !r.existing)).toBe(true)
  })

  it('preserves manual edits through defaults, existing changes, disable and regeneration', async () => {
    const p = await setup()
    p.samePrice.value = false
    expect(p.addRow('P105A', 4)).toBe(true)
    p.setCell('P105A', 'rent', 5_000_000)
    p.setCell('P105A', 'area', 35)
    p.setCell('P105A', 'floor', 8)
    p.defaultRent.value = 4_000_000
    p.defaultArea.value = 20
    p.existingRoomNumbers.value = ['OTHER']
    p.generator.value.roomsPerFloor = 4
    await nextTick()
    expect(p.rows.value.find(r => r.roomNumber === 'P105A')).toMatchObject({ rent: 5_000_000, area: 35, floor: 8, manual: true })
    p.enabled.value = false
    await nextTick()
    expect(p.toPayload()).toEqual([])
    p.enabled.value = true
    await nextTick()
    p.resetCell('P105A', 'floor')
    expect(p.rows.value.find(r => r.roomNumber === 'P105A')!.floor).toBe(4)
    p.samePrice.value = true
    p.samePrice.value = false
    await nextTick()
    expect(p.rows.value.find(r => r.roomNumber === 'P105A')).toMatchObject({ rent: 4_000_000, area: 35, overridden: ['area'] })
  })

  it('updates unedited manual defaults and resets manual cells to current defaults', async () => {
    const p = await setup()
    p.addRow('M1', 4)
    p.defaultRent.value = 4_000_000
    p.defaultArea.value = 25
    await nextTick()
    expect(p.rows.value.at(-1)).toMatchObject({ rent: 4_000_000, area: 25 })
    p.setCell('M1', 'area', 35)
    p.resetCell('M1', 'area')
    expect(p.rows.value.at(-1)).toMatchObject({ area: 25, overridden: [] })
  })

  it('keeps removals until the generated set changes, clearing implicated server markers', async () => {
    const p = await setup()
    p.markServerDuplicates(['P102', 'P103'])
    p.removeRow('P103')
    expect(p.serverDuplicates.value).toEqual(['P102'])
    p.defaultRent.value++
    p.generator.value.nameFloorStart = 10 // unused when includeFloor=false
    await nextTick()
    expect(p.rows.value.map(r => r.roomNumber)).toEqual(['P101', 'P102'])
    p.enabled.value = false
    await nextTick()
    p.enabled.value = true
    await nextTick()
    expect(p.rows.value.map(r => r.roomNumber)).toEqual(['P101', 'P102'])
    p.generator.value.roomsPerFloor = 4
    await nextTick()
    expect(p.rows.value.map(r => r.roomNumber)).toEqual(['P101', 'P102', 'P103', 'P104'])
  })

  it('keeps manual rows when generation fails and removes them explicitly', async () => {
    const p = await setup()
    p.addRow('M1', 2)
    p.setCell('M1', 'area', 30)
    p.generator.value.roomsPerFloor = 100
    await nextTick()
    expect(p.rows.value).toHaveLength(1)
    expect(p.rows.value[0]).toMatchObject({ roomNumber: 'M1', manual: true, area: 30 })
    expect(() => p.toPayload()).toThrow('Cấu hình sinh phòng không hợp lệ.')
    p.removeRow('M1')
    p.defaultRent.value++
    await nextTick()
    expect(p.rows.value).toEqual([])
  })

  it('keeps one edited manual identity when the generator expands into it', async () => {
    const p = await setup()
    p.addRow('p104', 4)
    p.setCell('p104', 'area', 35)
    p.generator.value.roomsPerFloor = 4
    await nextTick()
    expect(p.rows.value.map(r => r.roomNumber)).toEqual(['P101', 'P102', 'P103', 'p104'])
    expect(p.rows.value.at(-1)).toMatchObject({ manual: true, floor: 4, area: 35 })
    expect(p.duplicateRoomNumbers.value).toEqual([])
    p.removeRow('p104')
    p.defaultArea.value = 20
    await nextTick()
    expect(p.rows.value.map(r => r.roomNumber)).toEqual(['P101', 'P102', 'P103'])
  })

  it.each<[string, number]>([['', 1], ['   ', 1], ['A'.repeat(21), 1], ['M1', 0], ['M1', 101], ['M1', 1.5], ['M1', NaN]])('rejects invalid manual room %s on floor %s', async (name, floor) => {
    const p = await setup()
    expect(p.addRow(name, floor)).toBe(false)
    expect(p.rows.value).toHaveLength(3)
  })

  it('rejects slug duplicates and flags existing manual rows before payload conversion', async () => {
    const p = await setup()
    expect(p.addRow('p101', 1)).toBe(false)
    expect(p.addRow('M 1', 2)).toBe(true)
    expect(p.addRow('m-1', 2)).toBe(false)
    p.existingRoomNumbers.value = ['EXISTING-1']
    expect(p.addRow('Existing 1', 2)).toBe(true)
    expect(p.rows.value.at(-1)!.existing).toBe(true)
    expect(p.toPayload().map(r => r.room_number)).not.toContain('Existing 1')
  })

  it('enforces the payload limit including manual rows without silently truncating', async () => {
    const p = await setup()
    p.generator.value = { ...p.generator.value, floorTo: 2, roomsPerFloor: 99 }
    await nextTick()
    expect(p.addRow('M1', 1)).toBe(true)
    expect(p.addRow('M2', 1)).toBe(true)
    expect(p.addRow('M3', 1)).toBe(false)
    expect(p.toPayload()).toHaveLength(200)
    p.generator.value = { ...p.generator.value, floorTo: 4, roomsPerFloor: 50 }
    await nextTick()
    expect(() => p.toPayload()).toThrow('Tối đa 200 phòng mỗi lần.')
  })

  it('rejects duplicate or invalid restored payloads explicitly', async () => {
    const p = await setup()
    p.rows.value.push({ ...p.rows.value[0]!, roomNumber: 'p101' })
    expect(p.duplicateRoomNumbers.value).toEqual(['p101'])
    expect(() => p.toPayload()).toThrow('Mã phòng bị trùng.')
    p.rows.value.pop()
    p.setCell('P101', 'floor', 0)
    expect(() => p.toPayload()).toThrow('Thông tin phòng không hợp lệ.')
  })
})

describe('manual rows while disabled', () => {
  it('enforces the manual limit even while the preview is hidden', async () => {
    const p = await setup()
    p.enabled.value = false
    await nextTick()
    for (let i = 0; i < 200; i++) expect(p.addRow(`M${i}`, 1)).toBe(true)
    expect(p.addRow('EXTRA', 1)).toBe(false)
  })
})
