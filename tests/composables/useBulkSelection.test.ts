import { describe, expect, it } from 'vitest'

describe('useBulkSelection', () => {
  it('toggle adds then removes ids', async () => {
    const { useBulkSelection } = await import('../../app/composables/useBulkSelection')
    const { selectedIds, isSelected, toggle } = useBulkSelection()

    toggle('a')
    toggle('b')
    expect(selectedIds.value).toEqual(['a', 'b'])
    expect(isSelected('a')).toBe(true)

    toggle('a')
    expect(selectedIds.value).toEqual(['b'])
    expect(isSelected('a')).toBe(false)
  })

  it('selectAll replaces selection and clear empties it', async () => {
    const { useBulkSelection } = await import('../../app/composables/useBulkSelection')
    const { selectedIds, toggle, selectAll, clear } = useBulkSelection()

    toggle('x')
    selectAll(['a', 'b', 'c'])
    expect(selectedIds.value).toEqual(['a', 'b', 'c'])

    clear()
    expect(selectedIds.value).toEqual([])
  })

  it('isRunning starts false', async () => {
    const { useBulkSelection } = await import('../../app/composables/useBulkSelection')
    const { isRunning } = useBulkSelection()
    expect(isRunning.value).toBe(false)
  })

  it('each call returns an independent instance', async () => {
    const { useBulkSelection } = await import('../../app/composables/useBulkSelection')
    const a = useBulkSelection()
    const b = useBulkSelection()

    a.toggle('x')
    expect(a.selectedIds.value).toEqual(['x'])
    expect(b.selectedIds.value).toEqual([])
  })
})
