import { afterEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useLocalFormDraft } from '~/composables/useLocalFormDraft'

interface Form {
  name: string
  count: number
}

afterEach(() => {
  window.localStorage.clear()
})

describe('useLocalFormDraft', () => {
  it('reports hasDraft and restores a legacy plain value', () => {
    window.localStorage.setItem('form:a', JSON.stringify({ name: 'Zeno', count: 2 }))
    const formData = ref<Form>({ name: '', count: 0 })

    const draft = useLocalFormDraft<Form>({ key: 'form:a', formData })

    expect(draft.hasDraft.value).toBe(true)
    expect(draft.draftSavedAt.value).toBe('')
    expect(draft.restoreDraft()).toEqual({ name: 'Zeno', count: 2 })
    expect(formData.value).toEqual({ name: 'Zeno', count: 2 })
  })

  it('restores an envelope value and exposes savedAt', () => {
    window.localStorage.setItem(
      'form:b',
      JSON.stringify({ savedAt: '2026-07-09T00:00:00.000Z', data: { name: 'Env', count: 5 } }),
    )
    const formData = ref<Form>({ name: '', count: 0 })

    const draft = useLocalFormDraft<Form>({ key: 'form:b', formData, envelope: true })

    expect(draft.hasDraft.value).toBe(true)
    expect(draft.draftSavedAt.value).toBe('2026-07-09T00:00:00.000Z')
    expect(draft.restoreDraft()).toEqual({ name: 'Env', count: 5 })
  })

  it('clearDraft removes the stored value and flips hasDraft', () => {
    window.localStorage.setItem('form:c', JSON.stringify({ name: 'X', count: 1 }))
    const draft = useLocalFormDraft<Form>({ key: 'form:c' })

    expect(draft.hasDraft.value).toBe(true)
    draft.clearDraft()
    expect(window.localStorage.getItem('form:c')).toBeNull()
    expect(draft.hasDraft.value).toBe(false)
  })

  it('is inert when the key is null', () => {
    const draft = useLocalFormDraft<Form>({ key: null })
    expect(draft.hasDraft.value).toBe(false)
    expect(draft.restoreDraft()).toBeNull()
  })

  it('computes isDirty from the snapshot', () => {
    const formData = ref<Form>({ name: 'A', count: 1 })
    const snapshot = ref<Form | null>({ name: 'A', count: 1 })
    const draft = useLocalFormDraft<Form>({ key: 'form:d', formData, initialSnapshot: snapshot })

    expect(draft.isDirty.value).toBe(false)
    formData.value = { name: 'B', count: 1 }
    expect(draft.isDirty.value).toBe(true)
  })
})
