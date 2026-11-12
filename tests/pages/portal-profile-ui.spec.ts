import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const viewPage = readFileSync(resolve('app/pages/portal/profile/index.vue'), 'utf8')
const editPage = readFileSync(resolve('app/pages/portal/profile/edit.vue'), 'utf8')
const dossier = readFileSync(resolve('app/components/portal/PortalProfileDossier.vue'), 'utf8')

describe('portal profile refreshed UI', () => {
  it('uses the shared page rhythm, type roles, and matching skeletons', () => {
    expect(viewPage).toContain('space-y-5 px-4 py-5')
    expect(viewPage).toContain('portal-type-heading')
    expect(viewPage).toContain('portal-type-body')
    expect(viewPage).toContain('variant="statement"')
    expect(viewPage).toContain('variant="card"')
  })

  it('renders the dossier and routes editing to a dedicated screen', () => {
    expect(viewPage).toContain('<PortalProfileDossier')
    expect(viewPage).toContain(':profile="profile"')
    expect(viewPage).toContain(':room-number="contract?.roomNumber ?? null"')
    expect(viewPage).toContain(':building-name="contract?.buildingName ?? null"')
    expect(viewPage).not.toContain('<Teleport to="#portal-header-action">')
    expect(viewPage).not.toContain('to="/portal/profile/edit"')
    expect(viewPage).not.toContain('mode === \'view\'')
    expect(viewPage).not.toContain('@submit.prevent="onSave"')
  })

  it('keeps identity previews read-only while documents remain manageable on the profile view', () => {
    expect(viewPage).toContain('<PortalIdentityImageSlot')
    expect(viewPage.match(/:editable="false"/g)).toHaveLength(2)
    expect(viewPage).not.toContain('onIdentitySelect')
    expect(viewPage).not.toContain('onIdentityRemove')
    expect(viewPage).toContain('docs.documents.value')
    expect(viewPage).toContain('md:grid-cols-2')
    expect(viewPage).not.toContain('grid-cols-2 gap-2.5')
    expect(viewPage).toContain('Đăng xuất')
  })

  it('uses Figma-style icon-led account sections with portal tokens', () => {
    expect(viewPage).toContain('IconShield')
    expect(viewPage).toContain('IconLock')
    expect(viewPage).toContain('IconDocument')
    expect(viewPage).toContain('text-theme')
    expect(dossier).toContain('border-border-light')
    expect(`${viewPage}\n${dossier}`).not.toMatch(/#[0-9a-f]{3,8}/i)
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

  it('only exposes the four contact fields and no canonical image mutations', () => {
    expect(editPage.match(/<PortalInput/g)).toHaveLength(4)
    for (const key of ['phone', 'occupation', 'emergency_contact_name', 'emergency_contact_phone']) {
      expect(editPage).toContain(`v-model="form.${key}"`)
    }
    for (const key of ['full_name', 'gender', 'date_of_birth', 'permanent_address', 'id_number', 'id_issued_date', 'id_issued_place', 'notes']) {
      expect(editPage).not.toContain(`form.${key}`)
    }
    expect(editPage).not.toContain('usePortalIdentityImages')
    expect(editPage).not.toContain('onIdentitySelect')
    expect(editPage).not.toContain('onIdentityRemove')
  })

  it('keeps private notes out of the dossier and offers a value-free correction route', () => {
    expect(dossier).not.toContain('profile.notes')
    expect(dossier).toContain('Sửa thông tin liên hệ')
    expect(dossier).toContain('/portal/requests?intent=profile-correction')
    expect(dossier).toContain('Thông tin định danh được ban quản lý đối chiếu trước khi cập nhật.')
  })

  it('links profile security to the dedicated password route', () => {
    expect(viewPage).toContain('to="/portal/profile/password"')
    expect(viewPage).toContain('Đổi mật khẩu')
  })

  it('shares save state between header and sticky actions', () => {
    expect(editPage).toContain('@submit.prevent="onSave"')
    expect(editPage).toContain(':disabled="!canSave"')
    expect(editPage).toContain('portal-safe-bottom')
  })

  it('reveals validation feedback after blur or a save attempt', () => {
    expect(editPage).toContain('const touched = reactive')
    expect(editPage).toContain('const submitted = ref(false)')
    expect(editPage).toContain('@blur="touchField(\'phone\')"')
    expect(editPage).toContain('visibleError(\'phone\')')
    expect(editPage).toContain('serverFieldErrors.value[field]')
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
