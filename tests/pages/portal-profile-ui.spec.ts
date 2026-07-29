import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const viewPage = readFileSync(resolve('app/pages/portal/profile/index.vue'), 'utf8')
const editPage = readFileSync(resolve('app/pages/portal/profile/edit.vue'), 'utf8')

describe('portal profile refreshed UI', () => {
  it('uses the shared page rhythm, type roles, and matching skeletons', () => {
    expect(viewPage).toContain('space-y-5 px-4 py-5')
    expect(viewPage).toContain('portal-type-heading')
    expect(viewPage).toContain('portal-type-body')
    expect(viewPage).toContain('variant="statement"')
    expect(viewPage).toContain('variant="card"')
  })

  it('renders the dossier and routes editing to a dedicated screen', () => {
    expect(viewPage).toContain('<PortalProfileDossier :profile="profile"')
    expect(viewPage).toContain('<Teleport to="#portal-header-action">')
    expect(viewPage).toContain('to="/portal/profile/edit"')
    expect(viewPage).not.toContain('mode === \'view\'')
    expect(viewPage).not.toContain('@submit.prevent="onSave"')
  })

  it('keeps identity previews read-only while documents remain manageable on the profile view', () => {
    expect(viewPage).toContain('<PortalIdentityImageSlot')
    expect(viewPage.match(/:editable="false"/g)).toHaveLength(2)
    expect(viewPage).not.toContain('onIdentitySelect')
    expect(viewPage).not.toContain('onIdentityRemove')
    expect(viewPage).toContain('docs.documents.value')
    expect(viewPage).toContain('Đăng xuất')
  })

  it('uses semantic upload progress without inline presentation styles', () => {
    expect(viewPage).toContain('<progress')
    expect(viewPage).not.toContain(':style=')
    expect(viewPage.match(/<input/g)).toHaveLength(1)
    expect(viewPage).toContain('type="file"')
  })

  it('keeps document removal and logout keyboard-visible', () => {
    expect(viewPage).toContain('aria-label="Xóa tài liệu"')
    expect(viewPage).toContain('focus-visible:ring-2')
    expect(viewPage).toContain('@click="onLogout"')
  })

  it('uses a dedicated edit route with all twelve whitelisted fields', () => {
    expect(editPage).toContain("setChrome({ title: 'Chỉnh sửa hồ sơ', back: '/portal/profile' })")
    expect(editPage.match(/<PortalInput/g)).toHaveLength(11)
    expect(editPage).toContain('GENDER_OPTIONS')
    expect(editPage).toContain(':aria-pressed="form.gender === option.value"')
    expect(editPage).not.toContain('v-model="form.email"')
    expect(editPage).toContain('v-model="form.id_number"')
    expect(editPage).toContain('v-model="form.id_issued_date"')
    expect(editPage).toContain('v-model="form.id_issued_place"')
  })

  it('owns identity-image mutation controls on the edit route', () => {
    expect(editPage).toContain('usePortalIdentityImages()')
    expect(editPage).toContain("onIdentitySelect('front', file)")
    expect(editPage).toContain("onIdentitySelect('back', file)")
    expect(editPage).toContain("onIdentityRemove('front')")
    expect(editPage).toContain("onIdentityRemove('back')")
  })

  it('links profile security to the dedicated password route', () => {
    expect(viewPage).toContain('to="/portal/profile/password"')
    expect(viewPage).toContain('Đổi mật khẩu')
  })

  it('shares save state between header and sticky actions', () => {
    expect(editPage).toContain('<Teleport to="#portal-header-action">')
    expect(editPage).toContain('@submit.prevent="onSave"')
    expect(editPage).toContain(':disabled="!canSave"')
    expect(editPage).toContain('portal-safe-bottom')
  })

  it('reveals validation feedback after blur or a save attempt', () => {
    expect(editPage).toContain('const touched = reactive')
    expect(editPage).toContain('const submitted = ref(false)')
    expect(editPage).toContain('@blur="touchField(\'full_name\')"')
    expect(editPage).toContain('visibleError(\'full_name\')')
  })

  it('guards dirty navigation with a portal bottom sheet', () => {
    expect(editPage).toContain('onBeforeRouteLeave(guard.guardRouteLeave)')
    expect(editPage).toContain("window.addEventListener('beforeunload', guard.onBeforeUnload)")
    expect(editPage).toContain('<PortalBottomSheet')
    expect(editPage).toContain('Bỏ thay đổi?')
    expect(editPage).toContain('Tiếp tục chỉnh sửa')
    expect(editPage).toContain('Bỏ thay đổi')
  })
})
