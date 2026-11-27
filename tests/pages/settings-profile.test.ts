import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import Page from '~/pages/dashboard/settings/profile.vue'
import UiSection from '~/components/ui/UiSection.vue'
import UiSurfacePanel from '~/components/ui/UiSurfacePanel.vue'

const captured = vi.hoisted(() => ({
  onChange: null as null | ((files: File[] | null) => void),
  onDrop: null as null | ((files: File[] | null) => void),
  open: null as null | (() => void),
  reset: null as null | (() => void),
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  const { ref: vueRef } = await import('vue')
  captured.open = vi.fn()
  captured.reset = vi.fn()
  return {
    ...actual,
    useFileDialog: () => ({
      open: captured.open,
      reset: captured.reset,
      onChange: (cb: (files: File[] | null) => void) => { captured.onChange = cb },
    }),
    useDropZone: (_el: unknown, options: { onDrop: (files: File[] | null) => void }) => {
      captured.onDrop = options.onDrop
      return { isOverDropZone: vueRef(false) }
    },
  }
})

const profile = ref({ id: 'u', email: 'me@zeno.test', fullName: 'Tùng Nguyễn Thanh', avatarUrl: null, hasCustomAvatar: true, role: 'admin' })
const removeAvatar = vi.fn()
const uploadAvatar = vi.fn()
const uploadingAvatar = ref(false)
const toast = { success: vi.fn(), error: vi.fn() }

const stubs = {
  UiPageHeader: { template: '<header><slot /></header>' },
  UiSkeleton: true,
  UiAlert: true,
  UiSurfacePanel: { template: '<div><slot /></div>' },
  UiSection: { template: '<div><slot /></div>' },
  UiInput: true,
  UiButton: defineComponent({
    props: { disabled: Boolean, loading: Boolean },
    emits: ['click'],
    setup: (props, { slots, emit }) => () => h('button', { disabled: props.disabled || props.loading, onClick: () => emit('click') }, slots.default?.()),
  }),
}

function file(type: string, size: number): File {
  const f = new File(['x'], 'a.img', { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  captured.onChange = null
  captured.onDrop = null
  uploadingAvatar.value = false
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  vi.stubGlobal('useToast', () => toast)
  vi.stubGlobal('useUserProfile', () => ({
    profile, status: ref('success'), error: ref(null), refresh: vi.fn(), saving: ref(false), uploadingAvatar,
    fieldErrors: ref({}), updateFullName: vi.fn(), uploadAvatar, removeAvatar,
  }))
})

describe('settings profile', () => {
  it('titles the avatar and personal-info sections with the same panel chrome', async () => {
    const wrapper = mount(Page, { global: { stubs: { ...stubs, UiSurfacePanel, UiSection } } })
    await flushPromises()

    const headings = wrapper.findAll('h2')
    expect(headings.map(h => h.text())).toEqual(['Ảnh đại diện', 'Thông tin cá nhân'])
    expect(headings[0]!.classes()).toEqual(headings[1]!.classes())
    const panels = headings.map(h => h.element.closest('.rounded-xl'))
    expect(panels[0]).not.toBeNull()
    expect(panels[0]!.className).toBe(panels[1]!.className)
    expect(panels[0]).not.toBe(panels[1])
  })

  it('uses shared initials for the fallback avatar', async () => {
    const previous = profile.value
    profile.value = { ...previous, fullName: 'Tùng Nguyễn Thanh', avatarUrl: null, hasCustomAvatar: false }
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    try {
      expect(wrapper.get('span[aria-hidden="true"]').text()).toBe('TT')
    }
    finally {
      profile.value = previous
    }
  })
  it('shows email and role as read-only text, not disabled inputs', async () => {
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    expect(wrapper.find('dl').text()).toContain('me@zeno.test')
    expect(wrapper.find('dl').text()).toContain('Quản trị viên')
  })

  it('reports a failed avatar removal', async () => {
    removeAvatar.mockResolvedValueOnce(false)
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text() === 'Xoá ảnh')!.trigger('click')
    await flushPromises()
    expect(toast.error).toHaveBeenCalledWith('Không thể xoá ảnh đại diện.')
  })

  it('no longer links to a separate password page', async () => {
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Đổi mật khẩu')
  })

  it('opens the file dialog from the change button', async () => {
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text() === 'Đổi ảnh')!.trigger('click')
    expect(captured.open).toHaveBeenCalled()
  })

  it.each([
    ['dialog', (f: File) => captured.onChange!([f])],
    ['drop', (f: File) => captured.onDrop!([f])],
  ])('uploads a valid image from the %s path', async (_name, send) => {
    uploadAvatar.mockResolvedValueOnce(true)
    mount(Page, { global: { stubs } })
    await flushPromises()

    send(file('image/png', 1024))
    await flushPromises()
    expect(uploadAvatar).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Đã cập nhật ảnh đại diện.')
  })

  it.each([
    ['dialog', 'image/gif', 1024, (f: File) => captured.onChange!([f])],
    ['dialog', 'image/png', 2 * 1024 * 1024 + 1, (f: File) => captured.onChange!([f])],
    ['drop', 'image/gif', 1024, (f: File) => captured.onDrop!([f])],
    ['drop', 'image/webp', 3 * 1024 * 1024, (f: File) => captured.onDrop!([f])],
  ])('rejects an invalid file from the %s path (%s, %d bytes)', async (_name, type, size, send) => {
    mount(Page, { global: { stubs } })
    await flushPromises()

    send(file(type, size))
    await flushPromises()
    expect(toast.error).toHaveBeenCalledWith('Ảnh phải là JPEG, PNG hoặc WebP và không quá 2 MB.')
    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  it.each([
    ['dialog', (f: File) => captured.onChange!([f])],
    ['drop', (f: File) => captured.onDrop!([f])],
  ])('ignores a %s while an upload is in flight', async (_name, send) => {
    uploadingAvatar.value = true
    mount(Page, { global: { stubs } })
    await flushPromises()

    send(file('image/png', 1024))
    await flushPromises()
    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  it('blocks uploads and disables the buttons while a removal is pending', async () => {
    let finish!: (ok: boolean) => void
    removeAvatar.mockReturnValueOnce(new Promise<boolean>((resolve) => { finish = resolve }))
    const wrapper = mount(Page, { global: { stubs } })
    await flushPromises()

    const button = (label: string) => wrapper.findAll('button').find(b => b.text() === label)!
    await button('Xoá ảnh').trigger('click')
    captured.onDrop!([file('image/png', 1024)])
    captured.onChange!([file('image/png', 1024)])
    await flushPromises()
    expect(uploadAvatar).not.toHaveBeenCalled()
    expect(button('Đổi ảnh').attributes('disabled')).toBeDefined()
    expect(button('Xoá ảnh').attributes('disabled')).toBeDefined()

    finish(true)
    await flushPromises()
    expect(button('Xoá ảnh').attributes('disabled')).toBeUndefined()
  })

  it('ignores an empty drop', async () => {
    mount(Page, { global: { stubs } })
    await flushPromises()

    captured.onDrop!(null)
    captured.onDrop!([])
    expect(toast.error).not.toHaveBeenCalled()
    expect(uploadAvatar).not.toHaveBeenCalled()
  })
})
