import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const viewPage = readFileSync(resolve('app/pages/portal/profile.vue'), 'utf8')

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

  it('keeps identity images, documents, and logout on the profile view', () => {
    expect(viewPage).toContain('<PortalIdentityImageSlot')
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
})
