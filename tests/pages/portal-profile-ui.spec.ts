import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve('app/pages/portal/profile.vue'), 'utf8')

describe('portal profile refreshed UI', () => {
  it('uses the shared page rhythm, type roles, and matching skeletons', () => {
    expect(page).toContain('space-y-5 px-4 py-5')
    expect(page).toContain('portal-type-heading')
    expect(page).toContain('portal-type-body')
    expect(page).toContain('variant="statement"')
    expect(page).toContain('variant="card"')
  })

  it('routes all editable text through PortalTextField', () => {
    expect(page.match(/<PortalTextField/g)).toHaveLength(5)
    expect(page.match(/<input/g)).toHaveLength(1)
    expect(page).toContain('type="file"')
  })

  it('uses semantic upload progress without inline presentation styles', () => {
    expect(page).toContain('<progress')
    expect(page).not.toContain(':style=')
  })

  it('keeps document removal and logout keyboard-visible', () => {
    expect(page).toContain('aria-label="Xóa tài liệu"')
    expect(page).toContain('focus-visible:ring-2')
    expect(page).toContain('<PortalButton variant="secondary" block @click="onLogout">')
  })
})
