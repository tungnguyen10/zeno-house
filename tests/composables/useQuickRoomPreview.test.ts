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
  p.prefix.value = 'P'
  p.start.value = 101
  p.count.value = 3
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
    p.count.value = 4
    await nextTick()
    const r = p.rows.value.find(x => x.roomNumber === 'P102')!
    expect(r).toMatchObject({ rent: 4_000_000, area: 25, floor: 2 })
    expect(p.rows.value.find(x => x.roomNumber === 'P101')!.rent).toBe(3_200_000)
    expect(p.rows.value).toHaveLength(4)
  })

  it('drops edits for rooms that leave the range', async () => {
    const p = await setup()
    p.setCell('P103', 'area', 30)
    p.count.value = 2
    await nextTick()
    p.count.value = 3
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

  it('clamps count to 1..200', async () => {
    const p = await setup()
    p.count.value = 500
    await nextTick()
    expect(p.rows.value).toHaveLength(200)
    p.count.value = 0
    await nextTick()
    expect(p.rows.value).toHaveLength(1)
  })

  it('reports local duplicates by slug and builds payload', async () => {
    const p = await setup()
    p.prefix.value = ''
    p.start.value = 1
    p.count.value = 2
    await nextTick()
    expect(p.duplicateRoomNumbers.value).toEqual([])
    expect(p.toPayload()).toEqual([
      { room_number: '1', floor: 1, monthly_rent: 3_000_000, area: null },
      { room_number: '2', floor: 1, monthly_rent: 3_000_000, area: null },
    ])
  })

  it('tracks server duplicates until generator changes', async () => {
    const p = await setup()
    p.markServerDuplicates(['P101'])
    expect(p.serverDuplicates.value).toEqual(['P101'])
    p.prefix.value = 'A'
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
    p.start.value = 102
    await nextTick()
    expect(p.rows.value.map(row => row.roomNumber)).toEqual(['P102', 'P103', 'P104'])
    expect(p.rows.value[0]).toMatchObject({ area: 25, overridden: ['area'] })
    p.start.value = 101
    await nextTick()
    expect(p.rows.value[0]).toMatchObject({ area: null, overridden: [] })
  })

  it('resetCell uses the current defaults and removes only that override', async () => {
    const p = await setup()
    p.setCell('P101', 'area', 25)
    p.setCell('P101', 'floor', 3)
    p.defaultArea.value = 18
    p.defaultFloor.value = 2
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
      () => { p.start.value++ },
      () => { p.count.value++ },
      () => { p.prefix.value = 'A' },
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
      roomNumber, floor: 1, rent: 0, area: null, overridden: [],
    }))
    expect(p.duplicateRoomNumbers.value).toEqual(['PHONG-101', 'phong 101'])
    p.rows.value[1]!.roomNumber = 'P103'
    p.rows.value[2]!.roomNumber = 'P104'
    expect(p.duplicateRoomNumbers.value).toEqual([])
  })

  it.each([[-5, 1], [2.9, 2], [NaN, 1], [Infinity, 200]])('normalizes count %s to %s while disabled', async (value, expected) => {
    const p = await setup()
    p.enabled.value = false
    await nextTick()
    p.count.value = value
    await nextTick()
    expect(p.count.value).toBe(expected)
    expect(p.rows.value).toEqual([])
    p.enabled.value = true
    await nextTick()
    expect(p.rows.value).toHaveLength(expected)
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
