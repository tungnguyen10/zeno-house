import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve('app/pages/portal/profile/password.vue'), 'utf8')

describe('portal password UI', () => {
  it('uses the tenant shell and returns to the profile', () => {
    expect(page).toContain("layout: 'tenant'")
    expect(page).toContain("setChrome({ title: 'Đổi mật khẩu', back: '/portal/profile' })")
  })

  it('renders three revealable password fields with correct autocomplete', () => {
    expect(page.match(/<PortalInput/g)).toHaveLength(3)
    expect(page.match(/revealable/g)).toHaveLength(3)
    expect(page).toContain('autocomplete="current-password"')
    expect(page.match(/autocomplete="new-password"/g)).toHaveLength(2)
  })

  it('shares validation, saving, and API feedback with one submit action', () => {
    expect(page).toContain('tenantPasswordChangeSchema.safeParse')
    expect(page).toContain('@submit.prevent="onSubmit"')
    expect(page).toContain(':loading="saving"')
    expect(page).toContain(':disabled="!canSubmit"')
    expect(page).toContain('v-if="apiError"')
  })

  it('clears credentials, confirms success, and keeps the signed-in route flow', () => {
    expect(page).toContain("toast.success('Đã đổi mật khẩu.')")
    expect(page).toContain("await navigateTo('/portal/profile')")
    expect(page).not.toContain('signOut')
    expect(page).not.toContain('logout')
  })
})
