import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import ProfilePage from '~/pages/portal/profile/index.vue'

const profile = ref<unknown>({ id: 'tenant-a', fullName: 'Khách giả lập' })
const profileError = ref<unknown>(null)
const profileStatus = ref('success')
const identityError = ref<unknown>(null)
const identityRefresh = vi.fn(async () => {})
const profileRefresh = vi.fn(async () => {})
const logout = vi.fn(async () => {})
const toastError = vi.fn()

const stubs = {
  PortalButton: { props: ['loading'], template: '<button :disabled="loading"><slot /></button>' },
  PortalCard: { template: '<section><slot /></section>' },
  PortalProfileDossier: true,
  PortalBottomSheet: true,
  PortalSkeleton: true,
  PortalIdentityImageSlot: { template: '<div class="identity-slot">Chưa có ảnh</div>' },
  PortalEmptyState: { props: ['title', 'description', 'actionLabel'], emits: ['action'], template: '<section class="empty"><h2>{{title}}</h2><p>{{description}}</p><button @click="$emit(\'action\')">{{actionLabel}}</button></section>' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  IconShield: true, IconLock: true, IconChevronRight: true, IconDocument: true, IconPlus: true, IconLogOut: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  profile.value = { id: 'tenant-a', fullName: 'Khách giả lập' }
  profileError.value = null
  profileStatus.value = 'success'
  identityError.value = null
  logout.mockResolvedValue(undefined)
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('usePortalSessionKey', () => ref('portal-tenant-a-profile-actions'))
  vi.stubGlobal('usePortalChrome', () => ({ setChrome: vi.fn() }))
  vi.stubGlobal('usePortalToast', () => ({ error: toastError, success: vi.fn() }))
  vi.stubGlobal('useAuth', () => ({ logout }))
  vi.stubGlobal('usePortalProfile', () => ({ profile, error: profileError, status: profileStatus, refresh: profileRefresh }))
  vi.stubGlobal('usePortalContract', () => ({ contract: ref(null) }))
  vi.stubGlobal('usePortalIdentityImages', () => ({ images: ref({ frontSignedUrl: null, backSignedUrl: null }), status: ref('success'), error: identityError, refresh: identityRefresh }))
  vi.stubGlobal('usePortalDocuments', () => ({ documents: ref([]), status: ref('success'), error: ref(null), refresh: vi.fn(), uploading: ref(false), progress: ref(0) }))
})

describe('profile recovery stays available', () => {
  it('keeps the current profile mounted while the shared bootstrap refreshes', async () => {
    const wrapper = mount(ProfilePage, { global: { stubs } })
    const dossier = wrapper.get('portal-profile-dossier-stub').element
    profileStatus.value = 'pending'
    await wrapper.vm.$nextTick()
    expect(wrapper.get('portal-profile-dossier-stub').element).toBe(dossier)
    wrapper.unmount()
  })

  it('distinguishes an identity fetch error from missing images and retries the endpoint', async () => {
    identityError.value = new Error('Unavailable')
    const wrapper = mount(ProfilePage, { global: { stubs } })
    expect(wrapper.text()).toContain('Không tải được ảnh định danh')
    expect(wrapper.find('.identity-slot').exists()).toBe(false)
    const retry = wrapper.findAll('.empty button')[0]!
    await retry.trigger('click')
    expect(identityRefresh).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('allows logout even when the account no longer has a readable tenant profile', async () => {
    profile.value = null
    profileError.value = new Error('Tenant unavailable')
    const wrapper = mount(ProfilePage, { global: { stubs } })
    expect(wrapper.text()).toContain('Không tải được hồ sơ')
    const button = wrapper.findAll('button').find(item => item.text().includes('Đăng xuất'))!
    await button.trigger('click')
    expect(logout).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('shows a sign-out failure and permits another attempt', async () => {
    logout.mockRejectedValueOnce(new Error('Sign-out unavailable'))
    const wrapper = mount(ProfilePage, { global: { stubs } })
    const button = wrapper.findAll('button').find(item => item.text().includes('Đăng xuất'))!
    await button.trigger('click')
    await flushPromises()
    expect(toastError).toHaveBeenCalledOnce()
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(logout).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})
